'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Network, RefreshCw, X, Folder, FolderOpen, FileCode2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNetworkColor } from '@/lib/utils/colors';
import LoadingSpinner from './LoadingSpinner';

interface Method {
  name: string;
  fullPath: string;
}

interface Service {
  chain?: string;
  module?: string;
  service: string;
  methods?: Method[];
}

interface NetworkData {
  id: string;
  name: string;
  endpoint: string;
  tlsEnabled: boolean;
  services: Service[];
  color: ReturnType<typeof getNetworkColor>;
  loading?: boolean;
  error?: string;
}

interface NetworkPanelProps {
  networks: NetworkData[];
  onMethodSelect: (network: NetworkData, service: Service, method: Method) => void;
  onNetworkRemove: (networkId: string) => void;
  onNetworkRefresh: (networkId: string) => void;
}

// Helper to organize methods by their path structure
function organizeByPath(services: Service[]) {
  const tree: any = {};
  
  services.forEach(service => {
    const parts = service.service.split('.');
    let current = tree;
    
    // Build the tree structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { _children: {} };
      }
      current = current[part]._children;
    }
    
    // Add the service at the leaf
    const serviceName = parts[parts.length - 1];
    current[serviceName] = {
      ...service,
      _isService: true,
      _fullPath: service.service
    };
  });
  
  return tree;
}

// Recursive component to render the tree
function TreeNode({ 
  name, 
  node, 
  level = 0, 
  network, 
  onMethodSelect,
  path = ''
}: {
  name: string;
  node: any;
  level?: number;
  network: NetworkData;
  onMethodSelect: (network: NetworkData, service: Service, method: Method) => void;
  path?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullPath = path ? `${path}.${name}` : name;
  
  if (node._isService) {
    const hasMethods = node.methods && node.methods.length > 0;

    return (
      <div className="mb-1">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs",
            hasMethods && "cursor-pointer hover:bg-secondary/30",
            !hasMethods && "opacity-50 cursor-not-allowed border-l-2 border-muted"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={hasMethods ? () => setExpanded(!expanded) : undefined}
        >
          {hasMethods ? (
            expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <Circle className="h-2 w-2 text-muted-foreground" />
          )}
          <FileCode2 className={cn("h-3.5 w-3.5", hasMethods ? network.color.text : "text-muted-foreground")} />
          <span className="flex-1 truncate font-medium">{name}</span>
          <span className="text-[10px] text-muted-foreground px-1">
            {node.methods ? node.methods.length : 0}
          </span>
        </div>

        {expanded && hasMethods && (
          <div className="mt-0.5">
            {node.methods.map((method: Method) => (
              <div
                key={method.name}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer",
                  "hover:bg-primary/20 transition-colors text-xs",
                  "border-l-2 border-transparent hover:border-primary"
                )}
                style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }}
                onClick={() => onMethodSelect(network, node, method)}
              >
                <span className="text-primary">→</span>
                <span>{method.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // This is a folder/namespace
  const children = Object.entries(node._children || node).filter(([key]) => !key.startsWith('_'));
  
  return (
    <div className="mb-0.5">
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-secondary/20 transition-colors",
          "text-xs"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? 
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> : 
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className="flex-1 truncate">{name}</span>
        <span className="text-[10px] text-muted-foreground px-1">
          {children.length}
        </span>
      </div>
      
      {expanded && (
        <div>
          {children
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                level={level + 1}
                network={network}
                onMethodSelect={onMethodSelect}
                path={fullPath}
              />
            ))}
        </div>
      )}
    </div>
  );
}

const NetworkPanel: React.FC<NetworkPanelProps> = ({
  networks,
  onMethodSelect,
  onNetworkRemove,
  onNetworkRefresh,
}) => {
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  
  const toggleNetwork = (networkId: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev);
      if (next.has(networkId)) {
        next.delete(networkId);
      } else {
        next.add(networkId);
      }
      return next;
    });
  };
  
  // Filter services based on search
  const getFilteredServices = (services: Service[]) => {
    if (!filter) return services;
    return services.filter(svc => 
      svc.service.toLowerCase().includes(filter.toLowerCase()) ||
      svc.methods?.some(m => m.name.toLowerCase().includes(filter.toLowerCase()))
    );
  };
  
  return (
    <div className="h-full flex flex-col bg-muted/50 border-r border-primary/20">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/70">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Networks
        </h3>
        {networks.length > 0 && (
          <input
            type="text"
            placeholder="Filter methods..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={cn(
              "w-full mt-2 px-2 py-1 text-xs bg-input/50 border border-border rounded",
              "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
              "placeholder:text-muted-foreground/50"
            )}
          />
        )}
      </div>
      
      {/* Networks */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {networks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            No networks connected
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {networks.map((network, idx) => {
              const filteredServices = getFilteredServices(network.services);
              const tree = organizeByPath(filteredServices);
              
              return (
                <div
                  key={network.id}
                  className={cn(
                    "rounded-lg border overflow-hidden",
                    network.color.border
                  )}
                >
                  {/* Network Header */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer",
                      network.color.bg,
                      "hover:opacity-90 transition-opacity"
                    )}
                    onClick={() => toggleNetwork(network.id)}
                  >
                    {expandedNetworks.has(network.id) ? 
                      <ChevronDown className="h-3.5 w-3.5" /> : 
                      <ChevronRight className="h-3.5 w-3.5" />
                    }
                    <Network className={cn("h-4 w-4", network.color.text)} />
                    <span className="flex-1 text-sm font-medium truncate" title={network.endpoint}>
                      {network.name}
                    </span>
                    
                    {/* Connection Status */}
                    <span 
                      title={
                        network.loading ? "Connecting..." :
                        network.error ? `Error: ${network.error}` :
                        network.services.length > 0 ? "Connected" :
                        "No services"
                      }
                    >
                      <Circle 
                        className={cn(
                          "h-2 w-2 shrink-0",
                          network.loading ? "fill-yellow-500 animate-pulse" :
                          network.error ? "fill-destructive" :
                          network.services.length > 0 ? "fill-green-500" :
                          "fill-muted-foreground"
                        )}
                      />
                    </span>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {network.tlsEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                          TLS
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNetworkRefresh(network.id);
                        }}
                        className="p-1 hover:bg-secondary/50 rounded transition-colors"
                        disabled={network.loading}
                      >
                        <RefreshCw className={cn(
                          "h-3.5 w-3.5",
                          network.loading && "animate-spin"
                        )} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNetworkRemove(network.id);
                        }}
                        className="p-1 hover:bg-destructive/20 rounded transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Network Content */}
                  {expandedNetworks.has(network.id) && (
                    <div className="bg-background/30 border-t border-border/50">
                      {network.loading ? (
                        <div className="flex items-center justify-center py-4">
                          <LoadingSpinner />
                        </div>
                      ) : network.error ? (
                        <div className="p-3 text-xs text-destructive">
                          {network.error}
                        </div>
                      ) : filteredServices.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">
                          {filter ? `No matches for "${filter}"` : 'No services found'}
                        </div>
                      ) : (
                        <div className="py-2">
                          {Object.entries(tree)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([name, node]) => (
                              <TreeNode
                                key={name}
                                name={name}
                                node={node}
                                network={network}
                                onMethodSelect={onMethodSelect}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkPanel;