// components/ServiceList.tsx
import React, { useState, useEffect } from 'react';
import { Service, Method } from './GrpcExplorerApp';
import styles from './ServiceList.module.css';
import LoadingSpinner from './LoadingSpinner';

interface ServiceListProps {
  services: Service[];
  selectedService: Service | null;
  selectedMethod: Method | null;
  onServiceSelect: (service: Service) => void;
  onMethodSelect: (method: Method, service: Service) => void;
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
  endpoint = '',
  defaultExpanded = false,
  loading = false
}) => {
  const [filter, setFilter] = useState<string>('');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Load settings for expanded state when services change or defaultExpanded changes
  useEffect(() => {
    if (defaultExpanded && services.length > 0) {
      // If default expanded is true, expand all chains and modules
      const allChains = new Set<string>();
      const allModules = new Set<string>();

      services.forEach(service => {
        const chain = service.chain || 'default';
        const module = service.module || 'default';

        allChains.add(chain);
        allModules.add(`${chain}.${module}`);
      });

      setExpandedChains(allChains);
      setExpandedModules(allModules);
    }
  }, [services, defaultExpanded]);

  const toggleService = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedServices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const toggleChain = (chainId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChains((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chainId)) {
        newSet.delete(chainId);
      } else {
        newSet.add(chainId);
      }
      return newSet;
    });
  };

  const toggleModule = (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleServiceClick = (service: Service, e: React.MouseEvent) => {
    e.stopPropagation();
    onServiceSelect(service);
    toggleService(service.service, e);
  };

  const handleMethodClick = (method: Method, service: Service, e: React.MouseEvent) => {
    e.stopPropagation();
    onMethodSelect(method, service);
  };

  const filteredServices = services.filter((service) =>
  service.service.toLowerCase().includes(filter.toLowerCase())
  );

  const getServiceDisplayName = (serviceName: string) => {
    const parts = serviceName.split('.');
    return parts[parts.length - 1];
  };

  // Group services by chain and module
  const groupedServices: Record<string, Record<string, Service[]>> = {};

  filteredServices.forEach(service => {
    const chain = service.chain || 'default';
  const module = service.module || 'default';

  if (!groupedServices[chain]) {
    groupedServices[chain] = {};
  }

  if (!groupedServices[chain][module]) {
    groupedServices[chain][module] = [];
  }

  groupedServices[chain][module].push(service);
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
          {Object.entries(modules).map(([module, moduleServices]) => (
            <div key={`${chain}.${module}`} className={styles.moduleGroup}>
            <div
            className={styles.moduleName}
            onClick={(e) => toggleModule(`${chain}.${module}`, e)}
            >
            <span className={styles.expandIcon}>
            {expandedModules.has(`${chain}.${module}`) ? '▼' : '▶'}
            </span>
            <span>{module}</span>
            </div>

            {expandedModules.has(`${chain}.${module}`) && (
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
