'use client';

import React, { useState, useEffect } from 'react';
import { Play, Loader2, Copy, Check, RotateCcw, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import JsonViewer from './JsonViewer';
import { MethodTab } from '@/lib/utils/colors';

interface MethodInteractionPanelProps {
  activeMethod: MethodTab | null;
  onExecute?: (params: any) => Promise<any>;
}

const MethodInteractionPanel: React.FC<MethodInteractionPanelProps> = ({
  activeMethod,
  onExecute,
}) => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'response'>('params');
  
  // Reset when method changes
  useEffect(() => {
    setParams({});
    setResponse(null);
    setError(null);
    setActiveTab('params');
  }, [activeMethod?.id]);
  
  const handleExecute = async () => {
    if (!activeMethod || !onExecute) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await onExecute(params);
      setResponse(result);
      setActiveTab('response');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
      setActiveTab('response');
    } finally {
      setLoading(false);
    }
  };
  
  const handleParamChange = (key: string, value: string) => {
    try {
      // Try to parse as JSON for nested objects
      const parsed = JSON.parse(value);
      setParams(prev => ({ ...prev, [key]: parsed }));
    } catch {
      // If not valid JSON, treat as string
      setParams(prev => ({ ...prev, [key]: value }));
    }
  };
  
  const copyParams = () => {
    navigator.clipboard.writeText(JSON.stringify(params, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const resetParams = () => {
    setParams({});
    setResponse(null);
    setError(null);
  };
  
  const exportParams = () => {
    const data = {
      method: activeMethod?.method,
      service: activeMethod?.service,
      params: params,
      timestamp: new Date().toISOString()
    };
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${activeMethod?.method}-params-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const importParams = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const data = JSON.parse(content);
            setParams(data.params || data);
          } catch (err) {
            console.error('Failed to import params:', err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };
  
  if (!activeMethod) {
    return (
      <div className="h-full flex items-center justify-center bg-background/50">
        <div className="text-center space-y-2">
          <Play className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-sm text-muted-foreground">Select a method to interact with</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-black/40 dark:bg-black/60 border-r border-primary/20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", activeMethod.color.accent)} />
            <h3 className="text-sm font-semibold">{activeMethod.method}</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={resetParams}
              className="p-1.5 hover:bg-secondary/50 rounded transition-colors"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleExecute}
              disabled={loading}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Execute
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('params')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'params' ? 
              "bg-background border-b-2 border-primary" : 
              "hover:bg-secondary/20"
          )}
        >
          Parameters
        </button>
        <button
          onClick={() => setActiveTab('response')}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === 'response' ? 
              "bg-background border-b-2 border-primary" : 
              "hover:bg-secondary/20"
          )}
        >
          Response
          {(response || error) && (
            <span className={cn(
              "ml-2 px-1.5 py-0.5 text-xs rounded-full",
              error ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400"
            )}>
              {error ? 'Error' : 'Data'}
            </span>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {activeTab === 'params' ? (
          <div className="p-4 space-y-4">
            {/* JSON Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Request Parameters</label>
                <button
                  onClick={copyParams}
                  className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-secondary/50 rounded transition-colors"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              
              <textarea
                value={JSON.stringify(params, null, 2)}
                onChange={(e) => {
                  try {
                    setParams(JSON.parse(e.target.value));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                className={cn(
                  "w-full h-[400px] p-3 font-mono text-sm",
                  "bg-input border border-border rounded-lg",
                  "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
                  "placeholder:text-muted-foreground/50 resize-none"
                )}
                placeholder={`{\n  "field1": "value1",\n  "field2": 123\n}`}
                spellCheck={false}
              />
              
              <p className="text-xs text-muted-foreground">
                Enter valid JSON for the request parameters. 
                Use the method descriptor in the center panel for reference.
              </p>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setParams({})}
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary/50 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setParams({
                  example: "value",
                  nested: { field: "data" },
                  array: [1, 2, 3]
                })}
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary/50 transition-colors"
              >
                Load Example
              </button>
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={exportParams}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary/50 transition-colors"
                  title="Export parameters (Ctrl+Shift+E)"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
                <button
                  onClick={importParams}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary/50 transition-colors"
                  title="Import parameters (Ctrl+Shift+I)"
                >
                  <Upload className="h-3 w-3" />
                  Import
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full">
            {error ? (
              <div className="p-4">
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <h4 className="text-sm font-semibold text-destructive mb-2">Error</h4>
                  <pre className="text-xs font-mono text-destructive/80 whitespace-pre-wrap">
                    {error}
                  </pre>
                </div>
              </div>
            ) : response ? (
              <JsonViewer data={response} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="text-muted-foreground text-sm">
                    No response yet
                  </div>
                  <div className="text-xs text-muted-foreground/50">
                    Execute the method to see the response
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MethodInteractionPanel;