'use client';

import React, { useState } from 'react';
import { X, FileCode2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MethodTab } from '@/lib/utils/colors';

interface MethodTabsPanelProps {
  tabs: MethodTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  methodDescriptors?: Record<string, any>;
}

const MethodTabsPanel: React.FC<MethodTabsPanelProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  methodDescriptors = {},
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  const descriptor = activeTab ? methodDescriptors[activeTab.id] : null;
  
  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Tabs Bar */}
      <div className="flex items-center border-b border-border bg-card/30 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 border-r border-border/50",
              "cursor-pointer transition-all min-w-0",
              activeTabId === tab.id ? 
                "bg-background" : 
                "hover:bg-secondary/20"
            )}
            onClick={() => onTabSelect(tab.id)}
          >
            {/* Color indicator */}
            <div 
              className={cn("w-2 h-2 rounded-full shrink-0", tab.color.accent)} 
              title={tab.networkName}
            />
            
            {/* Method name */}
            <FileCode2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm truncate max-w-[150px]" title={tab.fullPath}>
              {tab.method}
            </span>
            
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className={cn(
                "ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100",
                "hover:bg-destructive/20 transition-all"
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        
        {tabs.length === 0 && (
          <div className="px-4 py-2 text-sm text-muted-foreground">
            Select a method from the network panel
          </div>
        )}
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {activeTab ? (
          <div className="p-4 space-y-4">
            {/* Method Header */}
            <div className={cn(
              "rounded-lg border p-4",
              activeTab.color.border,
              activeTab.color.bg
            )}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{activeTab.method}</h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {activeTab.fullPath}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      activeTab.color.bg,
                      activeTab.color.text,
                      "border",
                      activeTab.color.border
                    )}>
                      {activeTab.networkName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Service: {activeTab.service}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => copyToClipboard(activeTab.fullPath, activeTab.id)}
                  className="p-2 hover:bg-secondary/50 rounded transition-colors"
                  title="Copy full path"
                >
                  {copiedId === activeTab.id ? 
                    <Check className="h-4 w-4 text-green-400" /> : 
                    <Copy className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>
            
            {/* Request Descriptor */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Request Message
              </h4>
              <div className="rounded-lg border border-border bg-card/50 p-4">
                {descriptor?.request ? (
                  <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(descriptor.request, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Loading request descriptor...
                  </div>
                )}
              </div>
            </div>
            
            {/* Response Descriptor */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Response Message
              </h4>
              <div className="rounded-lg border border-border bg-card/50 p-4">
                {descriptor?.response ? (
                  <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(descriptor.response, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Loading response descriptor...
                  </div>
                )}
              </div>
            </div>
            
            {/* Method Metadata */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Method Info
              </h4>
              <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-mono">
                    {descriptor?.streaming ? 'Server Streaming' : 'Unary'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-mono text-xs">{activeTab.service}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network:</span>
                  <span>{activeTab.networkName}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <FileCode2 className="h-12 w-12 mx-auto opacity-20" />
              <p className="text-sm">No method selected</p>
              <p className="text-xs">Choose a method from the network panel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MethodTabsPanel;