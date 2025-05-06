// components/ServiceList.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method } from './GrpcExplorerApp';
import LoadingSpinner from './LoadingSpinner';
import styles from './ServiceList.module.css';

interface ServiceListProps {
  services: Service[];
  selectedService: Service | null;
  selectedMethod: Method | null;
  onServiceSelect: (_service: Service) => void;
  onMethodSelect: (_method: Method, _service: Service) => void;
  endpoint?: string;
  defaultExpanded?: boolean;
  loading?: boolean;
}

const ServiceList: React.FC<ServiceListProps> = ({
  services,
  selectedService,
  selectedMethod,
  onServiceSelect,
  onMethodSelect,
  defaultExpanded = false,
  loading = false
}) => {
  const [filter, setFilter] = useState<string>('');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  // Expand all services by default if specified
  useEffect(() => {
    if (defaultExpanded && services.length > 0) {
      const allChains = new Set<string>();
      const allModules = new Set<string>();
      
      services.forEach(service => {
        const chain = service.chain || 'default';
        const moduleItem = service.module || 'default';
        
        allChains.add(chain);
        allModules.add(`${chain}.${moduleItem}`);
      });
      
      setExpandedChains(allChains);
      setExpandedModules(allModules);
    }
  }, [services, defaultExpanded]);

  // Toggle a service's expanded state
  const toggleService = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  // Toggle a chain's expanded state
  const toggleChain = (chainId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chainId)) {
        newSet.delete(chainId);
      } else {
        newSet.add(chainId);
      }
      return newSet;
    });
  };

  // Toggle a module's expanded state
  const toggleModule = (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  // Handle service click
  const handleServiceClick = (service: Service, e: React.MouseEvent) => {
    e.stopPropagation();
    onServiceSelect(service);
    toggleService(service.service, e);
  };

  // Handle method click
  const handleMethodClick = (method: Method, service: Service, e: React.MouseEvent) => {
    e.stopPropagation();
    onMethodSelect(method, service);
  };

  // Filter services by search term
  const filteredServices = services.filter((service) =>
    service.service.toLowerCase().includes(filter.toLowerCase())
  );

  // Get the display name of a service
  const getServiceDisplayName = (serviceName: string) => {
    const parts = serviceName.split('.');
    return parts[parts.length - 1];
  };

  // Group services by chain and module
  const groupedServices: Record<string, Record<string, Service[]>> = {};

  filteredServices.forEach(service => {
    const chain = service.chain || 'default';
    const moduleItem = service.module || 'default';

    if (!groupedServices[chain]) {
      groupedServices[chain] = {};
    }

    if (!groupedServices[chain][moduleItem]) {
      groupedServices[chain][moduleItem] = [];
    }

    groupedServices[chain][moduleItem].push(service);
  });

  return (
    <div className={styles.container}>
      <div className={styles.searchContainer}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter services..."
          className={styles.searchInput}
        />
      </div>

      <div className={styles.serviceList}>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <LoadingSpinner size="md" />
            <span className="mt-2 text-text-secondary">Loading services...</span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className={styles.emptyState}>
            {filter ? 'No matching services found' : 'No services available'}
          </div>
        ) : (
          Object.entries(groupedServices).map(([chain, modules]) => (
            <div key={chain} className={styles.chainGroup}>
              <div
                className={styles.chainName}
                onClick={(e) => toggleChain(chain, e)}
              >
                <span className={styles.expandIcon}>
                  {expandedChains.has(chain) ? '▼' : '▶'}
                </span>
                <span>{chain}</span>
              </div>

              {expandedChains.has(chain) && (
                <div className={styles.moduleList}>
                  {Object.entries(modules).map(([moduleItem, moduleServices]) => (
                    <div key={`${chain}.${moduleItem}`} className={styles.moduleGroup}>
                      <div
                        className={styles.moduleName}
                        onClick={(e) => toggleModule(`${chain}.${moduleItem}`, e)}
                      >
                        <span className={styles.expandIcon}>
                        {expandedModules.has(`${chain}.${moduleItem}`) ? '▼' : '▶'}
                        </span>
                        <span>{moduleItem}</span>
                      </div>

                      {expandedModules.has(`${chain}.${moduleItem}`) && (
                        <div className={styles.servicesList}>
                          {moduleServices.map((service) => (
                            <div key={service.service} className={styles.serviceItem}>
                              <div
                                className={`${styles.serviceName} ${
                                  selectedService?.service === service.service ? styles.selected : ''
                                }`}
                                onClick={(e) => handleServiceClick(service, e)}
                              >
                                <span className={styles.expandIcon}>
                                  {expandedServices.has(service.service) ? '▼' : '▶'}
                                </span>
                                <span>{getServiceDisplayName(service.service)}</span>
                              </div>

                              {expandedServices.has(service.service) && service.methods && (
                                <div className={styles.methodList}>
                                  {service.methods.map((method) => (
                                    <div
                                      key={`${service.service}.${method.name}`}
                                      className={`${styles.methodItem} ${
                                        selectedMethod?.name === method.name &&
                                        selectedService?.service === service.service
                                          ? styles.selectedMethod
                                          : ''
                                      }`}
                                      onClick={(e) => handleMethodClick(method, service, e)}
                                    >
                                      {method.name}
                                    </div>
                                  ))}
                                  {service.methods.length === 0 && (
                                    <div className={styles.emptyMethods}>No methods available</div>
                                  )}
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
          ))
        )}
      </div>
    </div>
  );
};

export default ServiceList;