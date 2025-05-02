// components/GrpcExplorerApp.tsx
'use client';

import React, { useState, useEffect } from 'react';
import ServiceList from './ServiceList';
import MethodForm from './MethodForm';
import JsonViewer from './JsonViewer';
import LoadingSpinner from './LoadingSpinner';
import SettingsPanel from './SettingsPanel';
import { getCacheConfig } from '@/utils/cacheService';
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

const GrpcExplorerApp: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingService, setLoadingService] = useState<boolean>(false);
  const [loadingMethod, setLoadingMethod] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [endpoint, setEndpoint] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [useTLS, setUseTLS] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [cacheEnabled, setCacheEnabled] = useState<boolean>(true);

  useEffect(() => {
    // Load saved endpoint, TLS setting, and cache setting on component mount
    const storedEndpoint = localStorage.getItem('grpcEndpoint') || '';
    const storedUseTLS = localStorage.getItem('grpcUseTLS') === 'true';
    const cacheConfig = getCacheConfig();

    setEndpoint(storedEndpoint);
    setUseTLS(storedUseTLS);
    setCacheEnabled(cacheConfig.enabled);

    // If there's a stored endpoint, try to connect
    if (storedEndpoint) {
      handleEndpointSave();
    }
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
        setUseTLS(true);
      }
    }
  }, [endpoint]);

  const fetchServices = async (endpointUrl: string) => {
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
  };

  const handleServiceSelect = async (service: Service) => {
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
  };

  const handleMethodSelect = async (method: Method) => {
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
  };

  const executeQuery = async (params: Record<string, any>) => {
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
          useTLS
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
  };

  const handleEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndpoint(e.target.value);
  };

  const handleUseTLSChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseTLS(e.target.checked);
  };

  const handleEndpointSave = () => {
    if (endpoint) {
      localStorage.setItem('grpcEndpoint', endpoint);
      localStorage.setItem('grpcUseTLS', useTLS.toString());
      fetchServices(endpoint);
    }
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
    // Update cache setting from config
    const cacheConfig = getCacheConfig();
    setCacheEnabled(cacheConfig.enabled);
  };

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
    <input
    type="text"
    value={endpoint}
    onChange={handleEndpointChange}
    onKeyPress={handleKeyPress}
    placeholder="gRPC endpoint (host:port)"
    className={styles.endpointInput}
    />
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
    </div>

    {/* Settings Panel */}
    <SettingsPanel
    isOpen={isSettingsOpen}
    onClose={handleSettingsClose}
    />
    </div>
  );
};

export default GrpcExplorerApp;
