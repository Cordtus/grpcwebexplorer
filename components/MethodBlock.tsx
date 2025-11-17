'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Code, AlertCircle, Loader2, Pin } from 'lucide-react';
import { ExpandableBlock } from './ExpandableBlock';
import { cn } from '@/lib/utils';
import ProtobufFormGenerator from './ProtobufFormGenerator';
import { GrpcMethod, GrpcService, MethodInstance } from '@/lib/types/grpc';

interface MethodBlockProps {
  instance: MethodInstance;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onUpdateParams: (params: Record<string, any>) => void;
  onExecute: () => void;
  onTogglePin: () => void;
  isExecuting: boolean;
}

const MethodBlock = React.memo(function MethodBlock({
  instance,
  isSelected,
  onToggle,
  onRemove,
  onSelect,
  onUpdateParams,
  onExecute,
  onTogglePin,
  isExecuting
}: MethodBlockProps) {
  const [params, setParams] = useState<Record<string, any>>(instance.params || {});

  // Update parent when params change
  useEffect(() => {
    onUpdateParams(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const handleParamsChange = (newParams: Record<string, any>) => {
    setParams(newParams);
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
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Client streaming
              </span>
            )}
            {instance.method.responseStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                Server streaming
              </span>
            )}
            {!instance.method.requestStreaming && !instance.method.responseStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                Unary
              </span>
            )}
          </div>

          {/* Request/Response types */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Request:</span>
              <code className="font-mono text-blue-600 dark:text-blue-400">
                {instance.method.requestType}
              </code>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Response:</span>
              <code className="font-mono text-green-600 dark:text-green-400">
                {instance.method.responseType}
              </code>
            </div>
          </div>

          {/* Parameter inputs - using ProtobufFormGenerator */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground">Parameters</h4>
            <ProtobufFormGenerator
              messageType={instance.method.requestTypeDefinition}
              value={params}
              onChange={handleParamsChange}
            />
          </div>

          {/* Execute button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            disabled={!isValid || isExecuting}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
              isValid && !isExecuting
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
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
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
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
