'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Code, AlertCircle, Loader2, Pin, Plus, X, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { ExpandableBlock } from './ExpandableBlock';
import { cn } from '@/lib/utils';
import ProtobufFormGenerator from './ProtobufFormGenerator';
import { GrpcMethod, GrpcService, MethodInstance, GrpcAuthConfig, ExplorerMode } from '@/lib/types/grpc';

interface MethodBlockProps {
  instance: MethodInstance;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onUpdateParams: (params: Record<string, any>) => void;
  onUpdateMetadata: (metadata: Record<string, string>) => void;
  onUpdateAuth?: ((auth: GrpcAuthConfig) => void) | undefined;
  onExecute: () => void;
  onTogglePin: () => void;
  isExecuting: boolean;
  mode?: ExplorerMode | undefined;
  networkAuthConfig?: GrpcAuthConfig | undefined;
}

/** A single editable metadata header row */
interface MetadataRow {
  key: string;
  value: string;
}

const MethodBlock = React.memo(function MethodBlock({
  instance,
  isSelected,
  onToggle,
  onRemove,
  onSelect,
  onUpdateParams,
  onUpdateMetadata,
  onUpdateAuth,
  onExecute,
  onTogglePin,
  isExecuting,
  mode,
  networkAuthConfig
}: MethodBlockProps) {
  const [params, setParams] = useState<Record<string, any>>(instance.params || {});

  // Initialize metadata rows from instance.metadata
  const initRows = (): MetadataRow[] => {
    const meta = instance.metadata || {};
    const rows = Object.entries(meta).map(([key, value]) => ({ key, value }));
    return rows.length > 0 ? rows : [];
  };

  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>(initRows);
  const [metadataExpanded, setMetadataExpanded] = useState(false);

  // Authentication state
  const [authExpanded, setAuthExpanded] = useState(false);
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'api-key' | 'mtls'>(
    instance.authConfig?.type || networkAuthConfig?.type || 'none'
  );
  const [bearerToken, setBearerToken] = useState(
    instance.authConfig?.bearerToken || networkAuthConfig?.bearerToken || ''
  );
  const [apiKeyHeader, setApiKeyHeader] = useState(
    instance.authConfig?.apiKeyHeader || networkAuthConfig?.apiKeyHeader || ''
  );
  const [apiKeyValue, setApiKeyValue] = useState(
    instance.authConfig?.apiKeyValue || networkAuthConfig?.apiKeyValue || ''
  );
  const [clientCert, setClientCert] = useState(
    instance.authConfig?.clientCert || networkAuthConfig?.clientCert || ''
  );
  const [clientKey, setClientKey] = useState(
    instance.authConfig?.clientKey || networkAuthConfig?.clientKey || ''
  );

  // Update parent when params change
  useEffect(() => {
    onUpdateParams(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Update parent when metadata rows change
  useEffect(() => {
    const meta: Record<string, string> = {};
    for (const row of metadataRows) {
      if (row.key.trim()) {
        meta[row.key.trim()] = row.value;
      }
    }
    onUpdateMetadata(meta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataRows]);

  // Update parent when auth fields change
  useEffect(() => {
    if (!onUpdateAuth) return;
    onUpdateAuth({
      type: authType,
      ...(authType === 'bearer' ? { bearerToken } : {}),
      ...(authType === 'api-key' ? { apiKeyHeader, apiKeyValue } : {}),
      ...(authType === 'mtls' ? { clientCert, clientKey } : {}),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authType, bearerToken, apiKeyHeader, apiKeyValue, clientCert, clientKey]);

  const handleParamsChange = (newParams: Record<string, any>) => {
    setParams(newParams);
  };

  const handleAddMetadataRow = () => {
    setMetadataRows(prev => [...prev, { key: '', value: '' }]);
    setMetadataExpanded(true);
  };

  const handleRemoveMetadataRow = (index: number) => {
    setMetadataRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleMetadataKeyChange = (index: number, key: string) => {
    setMetadataRows(prev => prev.map((row, i) => i === index ? { ...row, key } : row));
  };

  const handleMetadataValueChange = (index: number, value: string) => {
    setMetadataRows(prev => prev.map((row, i) => i === index ? { ...row, value } : row));
  };

  // Check if method has required fields
  const hasRequiredFields = useMemo(() => {
    const definition = instance.method.requestTypeDefinition;
    if (!definition || !definition.fields || definition.fields.length === 0) {
      return false;
    }
    return definition.fields.some(f => f.rule === 'required');
  }, [instance.method.requestTypeDefinition]);

  // Validate required fields are filled
  const isValid = useMemo(() => {
    const definition = instance.method.requestTypeDefinition;
    if (!definition || !definition.fields || definition.fields.length === 0) {
      // No fields required, always valid
      return true;
    }

    const requiredFields = definition.fields.filter(f => f.rule === 'required');
    if (requiredFields.length === 0) {
      return true;
    }

    // Check all required fields have values
    return requiredFields.every(f => {
      const value = params[f.name];
      return value !== undefined && value !== null && value !== '';
    });
  }, [instance.method.requestTypeDefinition, params]);

  const activeMetadataCount = metadataRows.filter(r => r.key.trim()).length;

  const inputClassName = "flex-1 min-w-0 px-2 py-1 text-xs rounded border border-input bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring";
  const textareaClassName = "w-full px-2 py-1 text-xs rounded border border-input bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-none";

  return (
    <div onClick={onSelect} className="cursor-pointer">
      <ExpandableBlock
        title={instance.method.name}
        subtitle={`${instance.service.fullName}`}
        isExpanded={instance.expanded || false}
        onToggle={onToggle}
        color={instance.color}
        icon={<Code className="h-4 w-4" style={{ color: instance.color }} />}
        onRemove={onRemove}
        isActive={isSelected}
        className="transition-all"
        headerClassName={isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
        actions={
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={cn(
              "p-1 rounded transition-colors",
              instance.pinned
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={instance.pinned ? "Unpin method (allow auto-collapse)" : "Pin method (prevent auto-collapse)"}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        }
      >
        <div className="space-y-4">
          {/* Stream indicators */}
          <div className="flex gap-2">
            {instance.method.requestStreaming && (
              <span className="method-type-stream">Client streaming</span>
            )}
            {instance.method.responseStreaming && (
              <span className="method-type-stream">Server streaming</span>
            )}
            {!instance.method.requestStreaming && !instance.method.responseStreaming && (
              <span className="badge-muted">Unary</span>
            )}
          </div>

          {/* Request/Response types */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-muted-sm">
            <div className="flex-between">
              <span>Request:</span>
              <code className="font-mono text-blue-600 dark:text-blue-400">{instance.method.requestType}</code>
            </div>
            <div className="flex-between">
              <span>Response:</span>
              <code className="font-mono text-green-600 dark:text-green-400">{instance.method.responseType}</code>
            </div>
          </div>

          {/* Parameter inputs - using ProtobufFormGenerator */}
          <div className="space-y-3">
            <h4 className="section-subheader">Parameters</h4>
            <ProtobufFormGenerator
              messageType={instance.method.requestTypeDefinition}
              value={params}
              onChange={handleParamsChange}
            />
          </div>

          {/* Authentication (generic mode only) */}
          {mode === 'generic' && (
            <div className="space-y-2">
              <button
                onClick={(e) => { e.stopPropagation(); setAuthExpanded(v => !v); }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {authExpanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />
                }
                <Lock className="h-3 w-3" />
                Authentication
                {authType !== 'none' && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                    {authType}
                  </span>
                )}
              </button>

              {authExpanded && (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  <select
                    value={authType}
                    onChange={e => setAuthType(e.target.value as 'none' | 'bearer' | 'api-key' | 'mtls')}
                    className="w-full px-2 py-1 text-xs rounded border border-input bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api-key">API Key</option>
                    <option value="mtls">mTLS</option>
                  </select>

                  {authType === 'bearer' && (
                    <input
                      type="password"
                      value={bearerToken}
                      onChange={e => setBearerToken(e.target.value)}
                      placeholder="Bearer token"
                      className={inputClassName}
                      onClick={e => e.stopPropagation()}
                    />
                  )}

                  {authType === 'api-key' && (
                    <>
                      <input
                        type="text"
                        value={apiKeyHeader}
                        onChange={e => setApiKeyHeader(e.target.value)}
                        placeholder="Header name (e.g. x-api-key)"
                        className={inputClassName}
                        onClick={e => e.stopPropagation()}
                      />
                      <input
                        type="password"
                        value={apiKeyValue}
                        onChange={e => setApiKeyValue(e.target.value)}
                        placeholder="API key value"
                        className={inputClassName}
                        onClick={e => e.stopPropagation()}
                      />
                    </>
                  )}

                  {authType === 'mtls' && (
                    <>
                      <textarea
                        value={clientCert}
                        onChange={e => setClientCert(e.target.value)}
                        placeholder="PEM client certificate"
                        rows={3}
                        className={textareaClassName}
                        onClick={e => e.stopPropagation()}
                      />
                      <textarea
                        value={clientKey}
                        onChange={e => setClientKey(e.target.value)}
                        placeholder="PEM private key"
                        rows={3}
                        className={textareaClassName}
                        onClick={e => e.stopPropagation()}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metadata headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMetadataExpanded(v => !v);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {metadataExpanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />
                }
                Metadata Headers
                {activeMetadataCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                    {activeMetadataCount}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddMetadataRow();
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Add metadata header"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {metadataExpanded && (
              <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                {metadataRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1">
                    No headers. Click Add to include custom gRPC metadata (e.g. x-cosmos-block-height).
                  </p>
                ) : (
                  metadataRows.map((row, index) => (
                    <div key={index} className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={row.key}
                        onChange={e => handleMetadataKeyChange(index, e.target.value)}
                        placeholder="key"
                        className={inputClassName}
                        onClick={e => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={e => handleMetadataValueChange(index, e.target.value)}
                        placeholder="value"
                        className={inputClassName}
                        onClick={e => e.stopPropagation()}
                      />
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveMetadataRow(index);
                        }}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove header"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Execute button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            disabled={!isValid || isExecuting}
            className={cn(
              "w-full flex-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
              isValid && !isExecuting
                ? "btn-primary"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Execute Method
              </>
            )}
          </button>

          {!isValid && hasRequiredFields && (
            <div className="flex-center-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>Fill in required fields</span>
            </div>
          )}
        </div>
      </ExpandableBlock>
    </div>
  );
});

export default MethodBlock;
