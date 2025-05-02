// components/GrpcExplorerApp.tsx
'use client';

import React, { useState, useEffect } from 'react';
import ServiceList from './ServiceList';
import MethodForm from './MethodForm';
import JsonViewer from './JsonViewer';
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
}

const GrpcExplorerApp: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [endpoint, setEndpoint] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [useTLS, setUseTLS] = useState<boolean>(false);

  useEffect(() => {
    // Load saved endpoint and TLS setting on component mount
    const storedEndpoint = localStorage.getItem('grpcEndpoint') || '';
    const storedUseTLS = localStorage.getItem('grpcUseTLS') === 'true';

    setEndpoint(storedEndpoint);
    setUseTLS(storedUseTLS);

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
        `/api/services?endpoint=${encodeURIComponent(endpointUrl)}&useTLS=${useTLS}`
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
        const res = await fetch(
          `/api/service?service=${encodeURIComponent(service.service)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}`
        );
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        // Update the service with methods
        const updatedServices = services.map(s =>
        s.service === service.service ? { ...s, methods: data.methods } : s
        );

        setServices(updatedServices);
        setSelectedService({ ...service, methods: data.methods });
      }
    } catch (err) {
      console.error('Failed to fetch service methods:', err);
      setError('Failed to load service methods. Please check the console for details.');
    }
  };

  const handleMethodSelect = async (method: Method) => {
    try {
      setSelectedMethod(method);
      setResponse(null);
      setError(null);

      // Fetch method field definitions if not already loaded
      if (!method.fields && selectedService) {
        const res = await fetch(
          `/api/method?service=${encodeURIComponent(selectedService.service)}&method=${encodeURIComponent(method.name)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}`
        );
        const data = await res.json();

        if (data.error) {
          setError(data.error);
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
      }
    } catch (err) {
      console.error('Failed to fetch method fields:', err);
      setError('Failed to load method fields. Please check the console for details.');
    }
  };

  const executeQuery = async (params: Record<string, any>) => {
    if (!selectedService || !selectedMethod) return;

    try {
      setResponse(null);
      setError(null);

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

  return (
    <div className={styles.container}>
    <div className={styles.toolbar}>
    <div className={styles.endpointContainer}>
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
    <button
    onClick={handleRefresh}
    className={styles.refreshButton}
    disabled={loading || !connected}
    >
    Refresh
    </button>
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
    <ServiceList
    services={services}
    selectedService={selectedService}
    selectedMethod={selectedMethod}
    onServiceSelect={handleServiceSelect}
    onMethodSelect={handleMethodSelect}
    loading={loading}
    />
    </div>

    <div className={styles.centerPanel}>
    {selectedMethod ? (
      <MethodForm
      service={selectedService}
      method={selectedMethod}
      onExecute={executeQuery}
      />
    ) : (
      <div className={styles.placeholder}>
      <p>
      {services.length > 0
        ? 'Select a method from the left panel to start'
    : 'Enter a gRPC endpoint and connect to browse available services'}
    </p>
    </div>
    )}
    </div>

    <div className={styles.rightPanel}>
    {response ? (
      <JsonViewer data={response} />
    ) : (
      <div className={styles.placeholder}>
      <p>Response will appear here</p>
      </div>
    )}
    </div>
    </div>
    </div>
  );
};

export default GrpcExplorerApp;
