// components/ServiceList.tsx
import React, { useState } from 'react';
import { Service, Method } from './GrpcExplorerApp';
import styles from './ServiceList.module.css';

interface ServiceListProps {
  services: Service[];
  selectedService: Service | null;
  selectedMethod: Method | null;
  onServiceSelect: (service: Service) => void;
  onMethodSelect: (method: Method) => void;
  loading: boolean;
}

const ServiceList: React.FC<ServiceListProps> = ({
  services,
  selectedService,
  selectedMethod,
  onServiceSelect,
  onMethodSelect,
  loading,
}) => {
  const [filter, setFilter] = useState<string>('');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleService = (serviceId: string) => {
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

  const toggleChain = (chainId: string) => {
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

  const toggleModule = (moduleId: string) => {
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
    <div className={styles.header}>
    <div className={styles.headerControls}>
    <div className={styles.traffic}>
    <span className={styles.trafficLight} style={{ backgroundColor: '#FF605C' }} />
    <span className={styles.trafficLight} style={{ backgroundColor: '#FFBD44' }} />
    <span className={styles.trafficLight} style={{ backgroundColor: '#00CA4E' }} />
    </div>
    <div className={styles.headerTitle}>Services</div>
    </div>
    <div className={styles.searchContainer}>
    <input
    type="text"
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
    placeholder="Filter services..."
    className={styles.searchInput}
    />
    </div>
    </div>

    <div className={styles.serviceList}>
    {loading ? (
      <div className={styles.loading}>Loading services...</div>
    ) : filteredServices.length === 0 ? (
      <div className={styles.emptyState}>No services found</div>
    ) : (
      Object.entries(groupedServices).map(([chain, modules]) => (
        <div key={chain} className={styles.chainGroup}>
        <div
        className={styles.chainName}
        onClick={() => toggleChain(chain)}
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
            onClick={() => toggleModule(`${chain}.${module}`)}
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
                onClick={() => {
                  onServiceSelect(service);
                  toggleService(service.service);
                }}
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
                    onClick={() => onMethodSelect(method)}
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
