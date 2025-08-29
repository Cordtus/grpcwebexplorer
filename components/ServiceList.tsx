import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Package, Layers, Box, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Service {
  chain?: string;
  module?: string;
  service: string;
  methods?: Array<{ name: string }>;
}

export interface Method {
  name: string;
}

export interface ServiceListProps {
  services: Service[];
  selectedService: Service | null;
  selectedMethod: Method | null;
  onServiceSelect: (service: Service) => void;
  onMethodSelect: (method: Method, service: Service) => void;
  defaultExpanded?: boolean;
  loading?: boolean;
}

const ServiceList: React.FC<ServiceListProps> = ({
  services,
  selectedService,
  selectedMethod,
  onServiceSelect,
  onMethodSelect,
  defaultExpanded = true,
  loading = false,
}) => {
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  // Auto-expand on initial load
  useEffect(() => {
    if (defaultExpanded && services.length) {
      const chains = new Set<string>();
      const modules = new Set<string>();
      services.forEach(svc => {
        const chain = svc.chain || 'default';
        const moduleId = svc.module || 'default';
        chains.add(chain);
        modules.add(`${chain}.${moduleId}`);
      });
      setExpandedChains(chains);
      setExpandedModules(modules);
    }
  }, [services, defaultExpanded]);

  // Filter services
  const filtered = services.filter(svc =>
    svc.service.toLowerCase().includes(filter.toLowerCase())
  );

  // Group by chain -> module
  const grouped: Record<string, Record<string, Service[]>> = {};
  filtered.forEach(svc => {
    const chain = svc.chain || 'default';
    const moduleId = svc.module || 'default';
    if (!grouped[chain]) grouped[chain] = {};
    if (!grouped[chain][moduleId]) grouped[chain][moduleId] = [];
    grouped[chain][moduleId].push(svc);
  });

  const toggle = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-sm text-muted-foreground">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Filter input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter services..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-1.5 text-sm bg-input border border-border rounded-md 
                   focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
                   transition-colors"
        />
      </div>

      {/* Tree view */}
      {Object.entries(grouped).map(([chain, modules]) => (
        <div key={chain} className="select-none">
          {/* Chain */}
          <div
            className="tree-item group"
            onClick={() => toggle(setExpandedChains, chain)}
          >
            <ChevronRight className={cn(
              "h-3 w-3 transition-transform",
              expandedChains.has(chain) && "rotate-90"
            )} />
            <Package className="h-4 w-4 text-primary/70" />
            <span className="text-sm font-medium">{chain}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {Object.keys(modules).length} modules
            </span>
          </div>

          {/* Modules */}
          {expandedChains.has(chain) && (
            <div className="ml-4 mt-1 space-y-1">
              {Object.entries(modules).map(([moduleId, svcs]) => (
                <div key={`${chain}.${moduleId}`}>
                  <div
                    className="tree-item group"
                    onClick={() => toggle(setExpandedModules, `${chain}.${moduleId}`)}
                  >
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-transform",
                      expandedModules.has(`${chain}.${moduleId}`) && "rotate-90"
                    )} />
                    <Layers className="h-4 w-4 text-accent/70" />
                    <span className="text-sm">{moduleId}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {svcs.length} services
                    </span>
                  </div>

                  {/* Services */}
                  {expandedModules.has(`${chain}.${moduleId}`) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {svcs.map((svc) => (
                        <div key={svc.service}>
                          <div
                            className={cn(
                              "tree-item group",
                              selectedService?.service === svc.service && "selected"
                            )}
                            onClick={() => {
                              onServiceSelect(svc);
                              toggle(setExpandedServices, svc.service);
                            }}
                          >
                            <ChevronRight className={cn(
                              "h-3 w-3 transition-transform",
                              expandedServices.has(svc.service) && "rotate-90"
                            )} />
                            <Box className="h-4 w-4 text-secondary/70" />
                            <span className="text-sm flex-1 truncate" title={svc.service}>
                              {svc.service.split('.').pop()}
                            </span>
                            {svc.methods && (
                              <span className="text-xs text-muted-foreground">
                                {svc.methods.length}
                              </span>
                            )}
                          </div>

                          {/* Methods */}
                          {expandedServices.has(svc.service) && svc.methods && (
                            <div className="ml-8 mt-1 space-y-1">
                              {svc.methods.map((method) => (
                                <div
                                  key={method.name}
                                  className={cn(
                                    "tree-item group pl-6",
                                    selectedMethod?.name === method.name && 
                                    selectedService?.service === svc.service && 
                                    "selected"
                                  )}
                                  onClick={() => onMethodSelect(method, svc)}
                                >
                                  <Hash className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{method.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && filter && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No services match "{filter}"</p>
        </div>
      )}
    </div>
  );
};

export default ServiceList;