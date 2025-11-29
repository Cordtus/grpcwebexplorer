'use client';

import React, { useState } from 'react';
import { Copy, Check, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionResult {
  methodId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  duration?: number;
}

interface MethodInstance {
  id: string;
  networkId: string;
  method: any;
  service: any;
  color: string;
}

interface ResultsPanelProps {
  result: ExecutionResult | null;
  isExecuting: boolean;
  selectedMethod: MethodInstance | null;
}

function JsonViewer({ data, level = 0, path = '' }: { data: any; level?: number; path?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpanded(newExpanded);
  };

  const handleCopyValue = (value: any, key: string) => {
    const textToCopy = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
    navigator.clipboard.writeText(textToCopy);
    const newCopiedKeys = new Set(copiedKeys);
    newCopiedKeys.add(key);
    setCopiedKeys(newCopiedKeys);
    setTimeout(() => {
      setCopiedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }, 2000);
  };

  if (data === null) return <span className="text-muted-foreground">null</span>;
  if (data === undefined) return <span className="text-muted-foreground">undefined</span>;

  if (typeof data === 'string') {
    return <span className="text-green-600 dark:text-green-400 break-all">"{data}"</span>;
  }

  if (typeof data === 'number') {
    return <span className="text-blue-600 dark:text-blue-400">{data}</span>;
  }

  if (typeof data === 'boolean') {
    return <span className="text-purple-600 dark:text-purple-400">{data.toString()}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>[]</span>;

    const key = `${path}-array-${level}`;
    const isExpanded = level === 0 || expanded.has(key);
    const DISPLAY_LIMIT = 100; // Show first 100 items
    const hasMore = data.length > DISPLAY_LIMIT;
    const displayData = hasMore ? data.slice(0, DISPLAY_LIMIT) : data;

    return (
      <div className="w-full min-w-0 overflow-hidden">
        <div className="inline-flex items-center gap-1 group">
          <button
            onClick={() => toggleExpand(key)}
            className="inline-flex items-center hover:bg-muted rounded px-1"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className="text-muted-foreground ml-1">[{data.length}]</span>
          </button>
          <button
            onClick={() => handleCopyValue(data, key)}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity"
            title="Copy array"
          >
            {copiedKeys.has(key) ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
        {isExpanded && (
          <div className="ml-4 mt-1 min-w-0 overflow-hidden">
            {displayData.map((item, index) => (
              <div key={index} className="flex items-start min-w-0 overflow-hidden">
                <span className="text-muted-foreground mr-2 shrink-0">{index}:</span>
                <div className="flex-1 min-w-0 overflow-hidden break-all">
                  <JsonViewer data={item} level={level + 1} path={`${path}[${index}]`} />
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="text-xs text-muted-foreground italic mt-2 p-2 bg-muted rounded">
                ... and {data.length - DISPLAY_LIMIT} more items (showing first {DISPLAY_LIMIT} of {data.length})
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span>{}</span>;

    return (
      <div className="min-w-0 overflow-hidden">
        {entries.map(([key, value], index) => {
          const itemKey = `${path}.${key}`;
          const isExpanded = level === 0 || expanded.has(itemKey);
          const isObject = typeof value === 'object' && value !== null;

          return (
            <div key={key} className="mb-1 group min-w-0 overflow-hidden">
              <div className="flex items-start min-w-0">
                {isObject && (
                  <button
                    onClick={() => toggleExpand(itemKey)}
                    className="mr-1 hover:bg-muted rounded p-0.5 shrink-0"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                )}
                {!isObject && <span className="w-5 shrink-0" />}
                <span className="text-foreground font-medium shrink-0">{key}:</span>
                <div className="ml-2 flex-1 flex items-start gap-1 min-w-0 overflow-hidden">
                  {isObject ? (
                    <>
                      {isExpanded ? (
                        <div className="ml-4 flex-1 min-w-0 overflow-hidden">
                          <JsonViewer data={value} level={level + 1} path={itemKey} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {Array.isArray(value) ? `[${value.length}]` : '{...}'}
                        </span>
                      )}
                      <button
                        onClick={() => handleCopyValue(value, itemKey)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity shrink-0"
                        title={`Copy ${Array.isArray(value) ? 'array' : 'object'}`}
                      >
                        {copiedKeys.has(itemKey) ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 overflow-hidden break-all">
                        <JsonViewer data={value} level={level + 1} path={itemKey} />
                      </div>
                      <button
                        onClick={() => handleCopyValue(value, itemKey)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity shrink-0"
                        title="Copy value"
                      >
                        {copiedKeys.has(itemKey) ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <span>{JSON.stringify(data)}</span>;
}

export default function ResultsPanel({ result, isExecuting, selectedMethod }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const handleCopy = () => {
    if (result?.data) {
      navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveAsJSON = () => {
    if (!result?.data) return;

    const jsonString = JSON.stringify(result.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename from method name and timestamp
    const methodName = selectedMethod?.method.name || 'response';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `${methodName}_${timestamp}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-muted/50">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-border bg-muted/70">
        <h2 className="text-sm font-semibold text-foreground">Execution Results</h2>
        {result && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('formatted')}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  viewMode === 'formatted'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                Formatted
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  viewMode === 'raw'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                Raw
              </button>
            </div>
            <button
              onClick={handleSaveAsJSON}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              title="Save as JSON file"
            >
              <Save className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              title="Copy entire response"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 min-w-0 w-full">
        <div className="p-4 w-full max-w-full overflow-hidden">
        {isExecuting ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Executing method...</p>
              {selectedMethod && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedMethod.method.name}
                </p>
              )}
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* Status */}
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              result.success 
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            )}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {result.success ? 'Success' : 'Failed'}
              </span>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatTimestamp(result.timestamp)}</span>
              </div>
              <div className="text-right text-muted-foreground">
                Duration: {formatDuration(result.duration)}
              </div>
            </div>

            {/* Result Data */}
            {result.error ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Error</h3>
                <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">
                  {result.error}
                </pre>
              </div>
            ) : result.data ? (
              <div className="border border-primary/20 rounded-lg p-3 overflow-hidden">
                <h3 className="text-sm font-medium text-foreground mb-2">Response Data</h3>
                {viewMode === 'formatted' ? (
                  <div className="text-xs font-mono overflow-x-auto min-w-0 w-full">
                    <JsonViewer data={result.data} />
                  </div>
                ) : (
                  <pre className="text-xs text-foreground whitespace-pre font-mono bg-muted/50 p-3 rounded overflow-x-auto min-w-0">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <p className="text-sm">No response data</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 opacity-50" />
              </div>
              <p className="text-sm">No execution results yet</p>
              <p className="text-xs mt-1">Execute a method to see results</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}