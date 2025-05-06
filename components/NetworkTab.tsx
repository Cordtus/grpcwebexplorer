// components/NetworkTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import ServiceList from './ServiceList';
import { Service, Method } from './GrpcExplorerApp';
import LoadingSpinner from './LoadingSpinner';
import styles from './NetworkTab.module.css';

interface NetworkTabProps {
  endpoint: string;
  useTLS: boolean;
  cacheEnabled: boolean;
  onServiceSelect: (_service: Service) => void;
  onMethodSelect: (_method: Method, _service: Service, _endpoint: string) => void;
  selectedService: Service | null;
  selectedMethod: Method | null;
  isMinimized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  defaultExpanded: boolean;
}

interface EndpointInfo {
  url: string;
  useTLS: boolean;
  isActive: boolean;
}

interface NetworkInfo {
  chainId: string;
  bech32Prefix?: string;
  endpoints: EndpointInfo[];
}

const NetworkTab: React.FC<NetworkTabProps> = ({
  endpoint,
  useTLS,
  cacheEnabled,
  onServiceSelect,
  onMethodSelect,
  selectedService,
  selectedMethod,
  isMinimized,
  onMinimize,
  onMaximize,
  onClose,
  defaultExpanded
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string>(endpoint);

  // Helper function to execute gRPC calls
  const executeGrpcCall = useCallback(async (service: string, method: string, params = {}) => {
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          service,
          method,
          params,
          useTLS,
          useCache: cacheEnabled
        }),
      });
      
      const data = await res.json();
      if (data.error) {
        console.error(`Failed to execute ${service}.${method}:`, data.error);
        return null;
      }
      
      return data.response;
    } catch (err) {
      console.error(`Failed to execute ${service}.${method}:`, err);
      return null;
    }
  }, [endpoint, useTLS, cacheEnabled]);

  // Fetch available services from the endpoint
  const fetchServices = useCallback(async () => {
    if (!activeEndpoint) {
      setServices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/services?endpoint=${encodeURIComponent(activeEndpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
      );
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setServices([]);
      } else {
        setServices(data);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load services. Please check the console for details.');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [activeEndpoint, useTLS, cacheEnabled]);

  // Fetch Bech32Prefix as a fallback identifier
  const fetchBech32Prefix = useCallback(async () => {
    const data = await executeGrpcCall('cosmos.auth.v1beta1.Query', 'Bech32Prefix', {});
    return data?.bech32_prefix || null;
  }, [executeGrpcCall]);

  // Fetch node info to get chain ID
  const fetchNetworkInfo = useCallback(async () => {
    try {
      // Try to get chain ID from GetNodeInfo
      const nodeInfo = await executeGrpcCall(
        'cosmos.base.tendermint.v1beta1.Service', 
        'GetNodeInfo', 
        {}
      );
      
      let chainId = nodeInfo?.default_node_info?.network || null;
      let bech32Prefix = null;
      
      // If chain ID not found, try to get bech32 prefix as fallback
      if (!chainId) {
        bech32Prefix = await fetchBech32Prefix();
        if (bech32Prefix) {
          chainId = `${bech32Prefix}-network`;
        } else {
          // Last resort: use endpoint as network ID
          chainId = `network-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`;
        }
      } else {
        // If we have chain ID, still try to get bech32 prefix for display
        bech32Prefix = await fetchBech32Prefix();
      }
      
      // Check if we already have this network in local storage
      const existingNetworks = JSON.parse(localStorage.getItem('grpc_networks') || '{}');
      const currentEndpointInfo: EndpointInfo = {
        url: endpoint,
        useTLS,
        isActive: true
      };
      
      if (existingNetworks[chainId]) {
        // Network exists - update endpoints if needed
        const existingEndpoints = existingNetworks[chainId].endpoints || [];
        const endpointExists = existingEndpoints.some((e: EndpointInfo) => e.url === endpoint);
        
        let updatedEndpoints = existingEndpoints;
        
        if (!endpointExists) {
          updatedEndpoints = [...existingEndpoints, currentEndpointInfo];
        }
        
        // Set current endpoint as active, others as inactive
        updatedEndpoints = updatedEndpoints.map((e: EndpointInfo) => ({
          ...e,
          isActive: e.url === endpoint
        }));
        
        // Update network info in local storage
        const updatedNetwork = {
          ...existingNetworks[chainId],
          bech32Prefix: existingNetworks[chainId].bech32Prefix || bech32Prefix,
          endpoints: updatedEndpoints
        };
        
        existingNetworks[chainId] = updatedNetwork;
        localStorage.setItem('grpc_networks', JSON.stringify(existingNetworks));
        
        // Update component state
        setNetworkInfo(updatedNetwork);
      } else {
        // Create new network entry
        const newNetwork: NetworkInfo = {
          chainId,
          bech32Prefix,
          endpoints: [currentEndpointInfo]
        };
        
        existingNetworks[chainId] = newNetwork;
        localStorage.setItem('grpc_networks', JSON.stringify(existingNetworks));
        setNetworkInfo(newNetwork);
      }
    } catch (err) {
      console.error('Failed to fetch network info:', err);
      // Fallback to using endpoint as network ID
      setNetworkInfo({
        chainId: `network-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
        endpoints: [{ url: endpoint, useTLS, isActive: true }]
      });
    }
  }, [endpoint, useTLS, executeGrpcCall, fetchBech32Prefix]);

  // Initialize on component mount
  useEffect(() => {
    const initialize = async () => {
      await fetchNetworkInfo();
      await fetchServices();
    };
    
    initialize();
  }, [fetchNetworkInfo, fetchServices]);

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    onMaximize();
  };

  const handleEndpointChange = (endpointUrl: string) => {
    if (!networkInfo) return;
    
    // Update active endpoint in network info
    const updatedEndpoints = networkInfo.endpoints.map(e => ({
      ...e,
      isActive: e.url === endpointUrl
    }));

    // Update local state
    setNetworkInfo({
      ...networkInfo,
      endpoints: updatedEndpoints
    });
    setActiveEndpoint(endpointUrl);

    // Update in local storage
    const storedNetworks = JSON.parse(localStorage.getItem('grpc_networks') || '{}');
    if (storedNetworks[networkInfo.chainId]) {
      storedNetworks[networkInfo.chainId].endpoints = updatedEndpoints;
      localStorage.setItem('grpc_networks', JSON.stringify(storedNetworks));
    }
  };

  const handleServiceSelect = (service: Service) => {
    onServiceSelect(service);
  };

  const handleMethodSelect = (method: Method, service: Service) => {
    onMethodSelect(method, service, activeEndpoint);
  };

  // Helper function to get a display name for the network
  const getNetworkDisplayName = () => {
    if (!networkInfo) return 'Loading...';
    
    // If we have a bech32Prefix, show it with the chain ID
    if (networkInfo.bech32Prefix) {
      // Format the chain ID to look prettier
      const formattedChainId = networkInfo.chainId
        .replace(/-\d+$/, '')  // Remove version numbers at end
        .replace(/-/g, ' ');   // Replace dashes with spaces
      
      return `${networkInfo.bech32Prefix} (${formattedChainId})`;
    }
    
    // Fallback to just chain ID
    return networkInfo.chainId;
  };

  return (
    <div className={`${styles.container} ${isMaximized ? styles.maximized : ''} ${isMinimized ? styles.minimized : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.traffic}>
            <button
              className={`${styles.trafficButton} bg-error-red`}
              onClick={onClose}
              title="Close network"
            />
            <button
              className={`${styles.trafficButton} bg-warning-yellow`}
              onClick={onMinimize}
              title={isMinimized ? "Expand network" : "Minimize network"}
            />
            <button
              className={`${styles.trafficButton} bg-success-green`}
              onClick={handleMaximize}
              title={isMaximized ? "Restore size" : "Maximize network"}
            />
          </div>
          <div className={styles.endpointInfo}>
            <div className={styles.endpointName}>
              {getNetworkDisplayName()}
            </div>
            {networkInfo && networkInfo.endpoints.length > 1 && (
              <div className={styles.endpointDetails}>
                <select
                  value={activeEndpoint}
                  onChange={(e) => handleEndpointChange(e.target.value)}
                  className="bg-dark-bg text-xs border border-dark-border rounded px-1 py-0.5"
                >
                  {networkInfo.endpoints.map((e, index) => (
                    <option key={index} value={e.url}>
                      {e.url} {e.useTLS ? '(TLS)' : '(Plain)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {networkInfo && networkInfo.endpoints.length === 1 && (
              <div className={styles.endpointDetails}>
                <span className={styles.endpointUrl}>{activeEndpoint}</span>
                <span className={`${styles.tag} ${useTLS ? styles.tagTls : styles.tagPlain}`}>
                  {useTLS ? 'TLS' : 'Plaintext'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {!isMinimized && (
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <LoadingSpinner size="md" />
              <span>Loading services...</span>
            </div>
          ) : error ? (
            <div className={styles.error}>
              {error}
            </div>
          ) : (
            <ServiceList
              services={services}
              selectedService={selectedService}
              selectedMethod={selectedMethod}
              onServiceSelect={handleServiceSelect}
              onMethodSelect={handleMethodSelect}
              endpoint={activeEndpoint}
              defaultExpanded={defaultExpanded}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkTab;