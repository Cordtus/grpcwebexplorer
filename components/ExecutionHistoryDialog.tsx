'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, Clock, CheckCircle, XCircle, Trash2, Download, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExecutionRecord } from '@/lib/hooks/useExecutionHistory';
import JsonViewer from './JsonViewer';

interface ExecutionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  history: ExecutionRecord[];
  onClear: () => void;
  onExport: () => void;
  onReplay?: (record: ExecutionRecord) => void;
}

const ExecutionHistoryDialog: React.FC<ExecutionHistoryDialogProps> = ({ 
  open, 
  onClose, 
  history, 
  onClear,
  onExport,
  onReplay
}) => {
  const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return new Date(date).toLocaleDateString();
  };

  const handleRecordClick = (record: ExecutionRecord) => {
    setSelectedRecord(record);
    setViewMode('detail');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedRecord(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <DialogTitle>Execution History</DialogTitle>
          </div>
          <DialogDescription>
            View and manage your recent gRPC method executions
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {viewMode === 'list' ? (
            <>
              {/* List Actions */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  {history.length} execution{history.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                    disabled={history.length === 0}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClear}
                    disabled={history.length === 0}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              
              {/* History List */}
              <div className="overflow-y-auto max-h-[400px] space-y-1">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No execution history yet
                  </div>
                ) : (
                  history.map((record) => (
                    <div
                      key={record.id}
                      onClick={() => handleRecordClick(record)}
                      className={cn(
                        "p-3 rounded-lg border border-border cursor-pointer",
                        "hover:bg-secondary/20 transition-colors group"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {record.error ? (
                              <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {record.method}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {record.service}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(record.timestamp)}
                            </span>
                            <span>{record.network}</span>
                            {record.duration && (
                              <span className="font-mono">{formatDuration(record.duration)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : selectedRecord && (
            <>
              {/* Detail View Header */}
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                >
                  ← Back
                </Button>
                <div className="flex-1 flex items-center gap-2">
                  {selectedRecord.error ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span className="font-medium text-sm">{selectedRecord.method}</span>
                </div>
                {onReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onReplay(selectedRecord);
                      onClose();
                    }}
                  >
                    Replay
                  </Button>
                )}
              </div>
              
              {/* Detail View Content */}
              <div className="overflow-y-auto max-h-[400px] space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Network:</span>
                      <span className="ml-2 font-mono">{selectedRecord.network}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Service:</span>
                      <span className="ml-2 font-mono">{selectedRecord.service}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Method:</span>
                      <span className="ml-2 font-mono">{selectedRecord.method}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2 font-mono">{formatDuration(selectedRecord.duration)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Request Parameters</h4>
                  <div className="rounded-lg bg-input/50 p-3">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(selectedRecord.params, null, 2)}
                    </pre>
                  </div>
                </div>
                
                {selectedRecord.response && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Response</h4>
                    <div className="rounded-lg bg-input/50 overflow-hidden">
                      <JsonViewer data={selectedRecord.response} />
                    </div>
                  </div>
                )}
                
                {selectedRecord.error && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-destructive">Error</h4>
                    <div className="rounded-lg bg-destructive/10 p-3">
                      <pre className="text-xs font-mono text-destructive">
                        {selectedRecord.error}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExecutionHistoryDialog;