// components/GrpcExplorerApp.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ServiceList from './ServiceList';
import MethodForm from './MethodForm';
import JsonViewer from './JsonViewer';
import LoadingSpinner from './LoadingSpinner';
import SettingsPanel from './SettingsPanel';
import NetworkTab from './NetworkTab';
import MethodCard from './MethodCard';
import { getUserSettings, addEndpointToHistory, setUseTLS } from '@/utils/userSettings';
import Image from 'next/image';
import styles from './GrpcExplorerApp.module.css';

// Types
export interface Service {
  service: string;
  path: string;
  chain?: string;
  module?: string;
  methods?: Method[];
}

export interface Method {
  name: string;
  requestType: string;
  responseType: string;
  fields?: Field[];
}

export interface Field {
  name: string;
  type: string;
  repeated: boolean;
  id: number;
  options?: string;
}

export interface Network {
  id: string;
  endpoint: string;
  useTLS: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
}

export interface MethodSession {
  id: string;
  service: Service;
  method: Method;
  endpoint: string;
  useTLS: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
}

const GrpcExplorerApp: React.FC = () => {
  // Legacy state
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingService, setLoadingService] = useState<boolean>(false);
  const [loadingMethod, setLoadingMethod] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [endpoint, setEndpoint] = useState<string>('');
  const [useTLS, setUseTLSState] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // New multi-network state
  const [networks, setNetworks] = useState<Network[]>([]);
  const [_activeNetwork, setActiveNetwork] = useState<string | null>(null);
  
  // Method cards state
  const [methodSessions, setMethodSessions] = useState<MethodSession[]>([]);
  
  // Form state
  const [endpointHistory, setEndpointHistory] = useState<string[]>([]);
  const [showEndpointHistory, setShowEndpointHistory] = useState<boolean>(false);

  // Settings state
  const [cacheEnabled, setCacheEnabled] = useState<boolean>(true);
  const [_expandServicesByDefault, setExpandServicesByDefault] = useState<boolean>(false);
  const [_expandMethodsByDefault, setExpandMethodsByDefault] = useState<boolean>(false);

  // Define handleEndpointSave with useCallback before it's used in useEffect
  const handleEndpointSave = useCallback(() => {
    if (endpoint) {
      localStorage.setItem('grpcEndpoint', endpoint);
      localStorage.setItem('grpcUseTLS', useTLS.toString());
      
      // Fetch services
      fetchServices(endpoint);
      
      // Also use new method for multi-network support
      connectToEndpoint(endpoint, useTLS);
    }
  }, [endpoint, useTLS]);

  // Load user settings and endpoint history
  useEffect(() => {
    // Load saved endpoint, TLS setting, and cache setting on component mount
    const storedEndpoint = localStorage.getItem('grpcEndpoint') || '';
    const storedUseTLS = localStorage.getItem('grpcUseTLS') === 'true';
    
    // Load from userSettingsService for new features
    const settings = getUserSettings();
    setCacheEnabled(settings.cache.enabled);
    setExpandServicesByDefault(settings.ui.expandServicesByDefault);
    setExpandMethodsByDefault(settings.ui.expandMethodsByDefault);
    setEndpointHistory(settings.endpoints.history);

    // Set from local storage for backward compatibility
    setEndpoint(storedEndpoint);
    setUseTLSState(storedUseTLS);

    // If there's a stored endpoint, try to connect
    if (storedEndpoint) {
      handleEndpointSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect if endpoint likely requires TLS based on port number
  useEffect(() => {
    if (endpoint) {
      // Try to parse the endpoint to extract port
      const parts = endpoint.split(':');
      const port = parts.length > 1 ? parts[parts.length - 1] : null;

      // Common secure port numbers
      const securePorts = ['443', '8443', '9443', '4443'];

      if (port && securePorts.includes(port)) {
        setUseTLSState(true);
      }
    }
  }, [endpoint]);

  // Handle the settings change event
  const handleSettingsChanged = useCallback(() => {
    const settings = getUserSettings();
    setCacheEnabled(settings.cache.enabled);
    setExpandServicesByDefault(settings.ui.expandServicesByDefault);
    setExpandMethodsByDefault(settings.ui.expandMethodsByDefault);
  }, []);

  // Legacy fetch services (for backward compatibility)
  const fetchServices = useCallback(async (endpointUrl: string) => {
    if (!endpointUrl) {
      setServices([]);
      setConnected(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch services from the specified endpoint
      const res = await fetch(
        `/api/services?endpoint=${encodeURIComponent(endpointUrl)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
      );
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setConnected(false);
        return;
      }

      setServices(data);
      setConnected(true);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load services. Please check the console for details.');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [useTLS, cacheEnabled]);

  // Connect to an endpoint and create a new network tab
  const connectToEndpoint = useCallback((endpointUrl: string, useTlsFlag: boolean) => {
    if (!endpointUrl) return;
    
    // Check if this network already exists
    const existingNetwork = networks.find(n => n.endpoint === endpointUrl);
    
    if (existingNetwork) {
      // Network already exists, just make it active
      setActiveNetwork(existingNetwork.id);
      return;
    }
    
    // Create a new network
    const networkId = `network-${Date.now()}`;
    const newNetwork: Network = {
      id: networkId,
      endpoint: endpointUrl,
      useTLS: useTlsFlag,
      isMinimized: false,
      isMaximized: false
    };
    
    setNetworks(prev => [...prev, newNetwork]);
    setActiveNetwork(networkId);
    
    // Save endpoint to history
    addEndpointToHistory(endpointUrl);
    setUseTLS(useTlsFlag);
    
    // Update history list
    const settings = getUserSettings();
    setEndpointHistory(settings.endpoints.history);
  }, [networks]);

  // Legacy service select (for backward compatibility)
  const handleServiceSelect = useCallback(async (service: Service) => {
    try {
      setSelectedService(service);
      setSelectedMethod(null);
      setResponse(null);
      setError(null);

      // Fetch service methods if not already loaded
      if (!service.methods) {
        setLoadingService(true);
        const res = await fetch(
          `/api/service?service=${encodeURIComponent(service.service)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
        );
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setLoadingService(false);
          return;
        }

        // Update the service with methods
        const updatedServices = services.map(s =>
          s.service === service.service ? { ...s, methods: data.methods } : s
        );

        setServices(updatedServices);
        setSelectedService({ ...service, methods: data.methods });
        setLoadingService(false);
      }
    } catch (err) {
      console.error('Failed to fetch service methods:', err);
      setError('Failed to load service methods. Please check the console for details.');
      setLoadingService(false);
    }
  }, [services, endpoint, useTLS, cacheEnabled]);

  // Legacy method select (for backward compatibility)
  const handleMethodSelect = useCallback(async (method: Method) => {
    try {
      setSelectedMethod(method);
      setResponse(null);
      setError(null);

      // Fetch method field definitions if not already loaded
      if (!method.fields && selectedService) {
        setLoadingMethod(true);
        const res = await fetch(
          `/api/method?service=${encodeURIComponent(selectedService.service)}&method=${encodeURIComponent(method.name)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
        );
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setLoadingMethod(false);
          return;
        }

        // Update the method with fields
        if (selectedService && selectedService.methods) {
          const updatedMethods = selectedService.methods.map(m =>
            m.name === method.name ? { ...m, fields: data.fields } : m
          );

          setSelectedService({ ...selectedService, methods: updatedMethods });
          setSelectedMethod({ ...method, fields: data.fields });
        }
        setLoadingMethod(false);
      }
    } catch (err) {
      console.error('Failed to fetch method fields:', err);
      setError('Failed to load method fields. Please check the console for details.');
      setLoadingMethod(false);
    }
  }, [selectedService, endpoint, useTLS, cacheEnabled]);

  // New method for handling method selection with multi-network support
  const handleNetworkMethodSelect = useCallback((method: Method, service: Service, endpointUrl: string) => {
    // Also trigger legacy method for backward compatibility
    if (service && endpoint === endpointUrl) {
      handleServiceSelect(service);
      handleMethodSelect(method);
    }
    
    // Find the network
    const network = networks.find(n => n.endpoint === endpointUrl);
    if (!network) return;
    
    // Check if this method session already exists
    const sessionId = `${endpointUrl}-${service.service}-${method.name}`;
    const existingSession = methodSessions.find(s => 
      s.endpoint === endpointUrl && 
      s.service.service === service.service && 
      s.method.name === method.name
    );
    
    if (existingSession) {
      // Session already exists, update it if it's minimized
      if (existingSession.isMinimized) {
        setMethodSessions(prev => 
          prev.map(s => s.id === existingSession.id 
            ? { ...s, isMinimized: false } 
            : s
          )
        );
      }
      return;
    }
    
    // Create a new method session
    const newSession: MethodSession = {
      id: sessionId,
      service,
      method,
      endpoint: endpointUrl,
      useTLS: network.useTLS,
      isMinimized: false,
      isMaximized: false
    };
    
    setMethodSessions(prev => [...prev, newSession]);
  }, [networks, methodSessions, endpoint, handleServiceSelect, handleMethodSelect]);

  // Legacy execute query (for backward compatibility)
  const executeQuery = useCallback(async (params: Record<string, any>) => {
    if (!selectedService || !selectedMethod) return;

    try {
      setResponse(null);
      setError(null);
      setLoadingMethod(true);

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          service: selectedService.service,
          method: selectedMethod.name,
          params,
          useTLS,
          useCache: cacheEnabled
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResponse(data.response);
      }
    } catch (err) {
      console.error('Failed to execute query:', err);
      setError('Failed to execute query. Please check the console for details.');
    } finally {
      setLoadingMethod(false);
    }
  }, [selectedService, selectedMethod, endpoint, useTLS, cacheEnabled]);

  // Multi-network management functions
  const handleNetworkClose = useCallback((networkId: string) => {
    setNetworks(prev => prev.filter(n => n.id !== networkId));
    
    // Close all method sessions associated with this network
    const network = networks.find(n => n.id === networkId);
    if (network) {
      setMethodSessions(prev => prev.filter(s => s.endpoint !== network.endpoint));
    }
    
    // Set next active network
    setActiveNetwork(prev => {
      if (prev !== networkId) return prev;
      const remainingNetworks = networks.filter(n => n.id !== networkId);
      return remainingNetworks.length > 0 ? remainingNetworks[0].id : null;
    });
  }, [networks]);

  const handleNetworkMinimize = useCallback((networkId: string) => {
    setNetworks(prev => 
      prev.map(n => n.id === networkId 
        ? { ...n, isMinimized: !n.isMinimized } 
        : n
      )
    );
  }, []);

  const handleNetworkMaximize = useCallback((networkId: string) => {
    setNetworks(prev => 
      prev.map(n => n.id === networkId 
        ? { ...n, isMaximized: !n.isMaximized } 
        : n.id !== networkId && n.isMaximized ? { ...n, isMaximized: false } : n
      )
    );
  }, []);

  const handleMethodSessionClose = useCallback((sessionId: string) => {
    setMethodSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  const handleMethodSessionMinimize = useCallback((sessionId: string) => {
    setMethodSessions(prev => 
      prev.map(s => s.id === sessionId 
        ? { ...s, isMinimized: !s.isMinimized } 
        : s
      )
    );
  }, []);

  const handleMethodSessionMaximize = useCallback((sessionId: string) => {
    setMethodSessions(prev => 
      prev.map(s => s.id === sessionId 
        ? { ...s, isMaximized: !s.isMaximized } 
        : s.isMaximized ? { ...s, isMaximized: false } : s
      )
    );
  }, []);

  const handleEndpointHistorySelect = useCallback((historyEndpoint: string) => {
    setEndpoint(historyEndpoint);
    setShowEndpointHistory(false);
  }, []);

  // UI event handlers
  const handleEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndpoint(e.target.value);
  };

  const handleUseTLSChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseTLSState(e.target.checked);
  };

  const handleRefresh = () => {
    fetchServices(endpoint);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEndpointSave();
    }
  };

  const handleSettingsToggle = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
    handleSettingsChanged();
  };

  const closeEndpointHistory = () => {
    setShowEndpointHistory(false);
  };

  // Use either the classic UI or the new multi-network UI based on feature flags
  const shouldUseMultiNetworkUI = networks.length > 0 && methodSessions.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.endpointContainer}>
          <div className="flex items-center mr-3">
            <Image 
              src="/logo.svg" 
              alt="gRPC Explorer Logo" 
              width={24} 
              height={24} 
              className="mr-2"
            />
            <span className="font-medium text-text-primary">gRPC Explorer</span>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              value={endpoint}
              onChange={handleEndpointChange}
              onKeyPress={handleKeyPress}
              onFocus={() => endpointHistory.length > 0 && setShowEndpointHistory(true)}
              placeholder="gRPC endpoint (host:port)"
              className={styles.endpointInput}
            />
            {showEndpointHistory && endpointHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded shadow-lg z-10">
                <div className="flex justify-between items-center px-3 py-2 border-b border-dark-border">
                  <span className="text-xs text-text-secondary">Recent Endpoints</span>
                  <button onClick={closeEndpointHistory} className="text-text-secondary hover:text-text-primary text-xs">
                    ✕
                  </button>
                </div>
                <ul>
                  {endpointHistory.map((historyItem, index) => (
                    <li 
                      key={index} 
                      className="px-3 py-2 hover:bg-dark-highlight cursor-pointer text-sm"
                      onClick={() => handleEndpointHistorySelect(historyItem)}
                    >
                      {historyItem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className={styles.tlsContainer}>
            <label className={styles.tlsLabel}>
              <input
                type="checkbox"
                checked={useTLS}
                onChange={handleUseTLSChange}
                className={styles.tlsCheckbox}
              />
              Use TLS
            </label>
          </div>
          <button
            onClick={handleEndpointSave}
            className={styles.button}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleRefresh}
            className={styles.refreshButton}
            disabled={loading || !connected}
          >
            Refresh
          </button>
          <button
            onClick={handleSettingsToggle}
            className="ml-2 text-text-secondary hover:text-text-primary"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)} className={styles.closeButton}>
            ×
          </button>
        </div>
      )}

      <div className={styles.panelsContainer}>
        {shouldUseMultiNetworkUI ? (
          // New multi-network UI
          <>
            {/* Left Panel with Network Tabs */}
            <div className={styles.leftPanel}>
              <div className="flex flex-col h-full overflow-hidden">
                {networks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <Image 
                      src="/icon.svg" 
                      alt="gRPC Explorer" 
                      width={64} 
                      height={64} 
                      className="mb-4 opacity-30"
                    />
                    <p className="text-text-secondary">
                      Enter a gRPC endpoint and connect to browse available services
                    </p>
                  </div>
                ) : (
                  networks.map(network => (
                    <NetworkTab
                      key={network.id}
                      endpoint={network.endpoint}
                      useTLS={network.useTLS}
                      cacheEnabled={cacheEnabled}
                      onServiceSelect={handleServiceSelect}
                      onMethodSelect={handleNetworkMethodSelect}
                      selectedService={selectedService}
                      selectedMethod={selectedMethod}
                      isMinimized={network.isMinimized}
                      onMinimize={() => handleNetworkMinimize(network.id)}
                      onMaximize={() => handleNetworkMaximize(network.id)}
                      onClose={() => handleNetworkClose(network.id)}
                      defaultExpanded={_expandServicesByDefault}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Center Panel with Method Cards */}
            <div className={styles.centerPanel}>
              {methodSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Image 
                    src="/icon.svg" 
                    alt="gRPC Explorer" 
                    width={64} 
                    height={64} 
                    className="mb-4 opacity-30"
                  />
                  <p className="text-center text-text-secondary">
                    {networks.length > 0
                      ? 'Select a method from the left panel to start'
                      : 'Enter a gRPC endpoint and connect to browse available services'}
                  </p>
                </div>
              ) : (
                <div className="p-4 overflow-auto h-full">
                  {methodSessions.map(session => (
                    <MethodCard
                      key={session.id}
                      service={session.service}
                      method={session.method}
                      endpoint={session.endpoint}
                      useTLS={session.useTLS}
                      cacheEnabled={cacheEnabled}
                      onClose={() => handleMethodSessionClose(session.id)}
                      onMinimize={() => handleMethodSessionMinimize(session.id)}
                      onMaximize={() => handleMethodSessionMaximize(session.id)}
                      isMinimized={session.isMinimized}
                      isMaximized={session.isMaximized}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Classic UI (for backward compatibility)
          <>
            <div className={styles.leftPanel}>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-text-secondary">Loading services...</p>
                </div>
              ) : (
                <ServiceList
                  services={services}
                  selectedService={selectedService}
                  selectedMethod={selectedMethod}
                  onServiceSelect={handleServiceSelect}
                  onMethodSelect={handleMethodSelect}
                  loading={loading}
                  defaultExpanded={_expandServicesByDefault}
                />
              )}
            </div>

            <div className={styles.centerPanel}>
              {loadingService ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-text-secondary">Loading service methods...</p>
                </div>
              ) : loadingMethod ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-text-secondary">Loading method details...</p>
                </div>
              ) : selectedMethod ? (
                <MethodForm
                  service={selectedService}
                  method={selectedMethod}
                  onExecute={executeQuery}
                  isLoading={loadingMethod}
                />
              ) : (
                <div className={styles.placeholder}>
                  <Image
                    src="/icon.svg"
                    alt="gRPC Explorer"
                    width={64}
                    height={64}
                    className="mb-4 opacity-30"
                  />
                  <p className="text-center">
                    {services.length > 0
                      ? 'Select a method from the left panel to start'
                      : 'Enter a gRPC endpoint and connect to browse available services'}
                  </p>
                </div>
              )}
            </div>

            <div className={styles.rightPanel}>
              {loadingMethod && selectedMethod ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-text-secondary">Executing request...</p>
                </div>
              ) : response ? (
                <JsonViewer data={response} />
              ) : (
                <div className={styles.placeholder}>
                  <Image
                    src="/icon.svg"
                    alt="gRPC Explorer"
                    width={64}
                    height={64}
                    className="mb-4 opacity-30"
                  />
                  <p className="text-center">Response will appear here</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={handleSettingsClose}
        onSettingsChanged={handleSettingsChanged}
      />
    </div>
  );
};

export default GrpcExplorerApp;