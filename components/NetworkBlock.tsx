'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, Search, Loader2, AlertCircle, Server, RefreshCw } from 'lucide-react';
import { ExpandableBlock } from './ExpandableBlock';
import { cn } from '@/lib/utils';
import { GrpcNetwork, GrpcService, GrpcMethod } from '@/lib/types/grpc';

interface NetworkBlockProps {
  network: GrpcNetwork;
  onToggle: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  onSelectMethod: (service: GrpcService, method: GrpcMethod) => void;
}

interface NamespaceGroup {
  namespace: string;
  services: {
    service: GrpcService;
    methods: GrpcMethod[];
  }[];
  methodCount: number;
}

// Group methods by namespace and consolidate versions
function groupMethodsByNamespace(services: GrpcService[]): NamespaceGroup[] {
  const namespaceMap = new Map<string, NamespaceGroup>();

  services.forEach(service => {
    // Extract namespace from service name (e.g., cosmos.bank.v1beta1 -> cosmos.bank)
    const parts = service.fullName.split('.');
    let namespace = parts[0];
    
    // If it has version suffix (v1beta1, v1, v2, etc.), group by base namespace
    if (parts.length >= 2) {
      const versionPattern = /^v\d+(beta\d+)?$/;
      const lastPart = parts[parts.length - 1];
      
      if (versionPattern.test(lastPart)) {
        namespace = parts.slice(0, -1).join('.');
      } else {
        namespace = parts.join('.');
      }
    }

    if (!namespaceMap.has(namespace)) {
      namespaceMap.set(namespace, {
        namespace,
        services: [],
        methodCount: 0
      });
    }

    const group = namespaceMap.get(namespace)!;
    
    // Deduplicate methods by name within namespace
    const uniqueMethods = new Map<string, GrpcMethod>();
    service.methods.forEach(method => {
      const methodKey = method.name;
      if (!uniqueMethods.has(methodKey) || 
          // Prefer methods from newer versions
          service.fullName.includes('v2') || 
          (service.fullName.includes('v1') && !service.fullName.includes('beta'))) {
        uniqueMethods.set(methodKey, method);
      }
    });

    group.services.push({
      service,
      methods: Array.from(uniqueMethods.values())
    });
    group.methodCount += uniqueMethods.size;
  });

  return Array.from(namespaceMap.values()).sort((a, b) => 
    a.namespace.localeCompare(b.namespace)
  );
}

const NetworkBlock = React.memo(function NetworkBlock({
  network,
  onToggle,
  onRemove,
  onRefresh,
  onSelectMethod
}: NetworkBlockProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set());

  // Group services by namespace
  const namespaceGroups = useMemo(() =>
    groupMethodsByNamespace(network.services),
    [network.services]
  );

  // Filter methods based on search
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return namespaceGroups;

    return namespaceGroups.map(group => ({
      ...group,
      services: group.services.map(({ service, methods }) => ({
        service,
        methods: methods.filter(method =>
          method?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          method?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(s => s.methods.length > 0)
    })).filter(g => g.services.length > 0);
  }, [namespaceGroups, searchTerm]);

  const toggleNamespace = (namespace: string) => {
    const newExpanded = new Set(expandedNamespaces);
    if (newExpanded.has(namespace)) {
      newExpanded.delete(namespace);
    } else {
      newExpanded.add(namespace);
    }
    setExpandedNamespaces(newExpanded);
  };

  const subtitle = network.chainId
    ? `${network.endpoint}${network.endpoints && network.endpoints.length > 0 ? ` (+${network.endpoints.length} fallback${network.endpoints.length > 1 ? 's' : ''})` : ''}`
    : network.endpoint;

  return (
    <ExpandableBlock
      title={network.chainId || network.endpoint}
      subtitle={subtitle}
      isExpanded={network.expanded || false}
      onToggle={onToggle}
      color={network.color}
      icon={<Server className="h-4 w-4" style={{ color: network.color }} />}
      onRemove={onRemove}
      actions={
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          disabled={network.loading}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            network.loading
              ? "text-muted-foreground cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Refresh services (clear cache)"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", network.loading && "animate-spin")} />
        </button>
      }
      className="shadow-sm"
    >
      {network.loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading services...</span>
        </div>
      ) : network.error ? (
        <div className="flex items-center text-destructive p-4 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm">{network.error}</span>
        </div>
      ) : (
        <>
          {/* Search */}
          {network.services.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search methods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-input"
                />
              </div>
            </div>
          )}

          {/* Namespaces */}
          <div className="space-y-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">
                  {searchTerm ? 'No methods found' : 'No services available'}
                </p>
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.namespace} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleNamespace(group.namespace)}
                    className="w-full flex items-center gap-2 p-3 hover:bg-muted transition-colors"
                  >
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedNamespaces.has(group.namespace) && "rotate-90"
                      )}
                    />
                    <div className="marquee-container flex-1 min-w-0">
                      <span className="marquee-text font-medium text-sm" data-long={group.namespace.length > 30 ? "true" : "false"}>
                        {group.namespace}
                      </span>
                    </div>
                  </button>

                  {expandedNamespaces.has(group.namespace) && (
                    <div className="border-t border-border">
                      {group.services.map(({ service, methods }) => (
                        <div key={service.fullName} className="divide-y divide-border">
                          {methods.map(method => (
                            <button
                              key={method.fullName}
                              onClick={() => onSelectMethod(service, method)}
                              className="w-full px-4 py-2 text-left hover:bg-muted transition-colors group"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="marquee-container flex-1 min-w-0">
                                      <code className="marquee-text text-xs font-mono text-primary" data-long={method.name.length > 25 ? "true" : "false"}>
                                        {method.name}
                                      </code>
                                    </div>
                                    {method.requestStreaming && (
                                      <span className="text-[10px] px-1 py-0.5 rounded bg-success-green/20 text-success-green shrink-0">
                                        stream
                                      </span>
                                    )}
                                    {method.responseStreaming && (
                                      <span className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                                        stream
                                      </span>
                                    )}
                                  </div>
                                  <div className="marquee-container text-[10px] text-muted-foreground mt-0.5">
                                    <span className="marquee-text" data-long={service.fullName.length > 40 ? "true" : "false"}>
                                      {service.fullName}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </ExpandableBlock>
  );
});

export default NetworkBlock;