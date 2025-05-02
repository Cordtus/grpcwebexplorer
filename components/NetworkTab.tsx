// components/NetworkTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import ServiceList from './ServiceList';
import { Service, Method } from './GrpcExplorerApp';
import LoadingSpinner from './LoadingSpinner';
import _styles from './NetworkTab.module.css';

interface NetworkTabProps {
  endpoint: string;
  useTLS: boolean;
  cacheEnabled: boolean;
  onServiceSelect: (service: Service) => void;
  onMethodSelect: (_method: Method, _service: Service, _endpoint: string) => void;
  selectedService: Service | null;
  selectedMethod: Method | null;
  isMinimized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  defaultExpanded: boolean;
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

  const fetchServices = useCallback(async () => {
    if (!endpoint) {
      setServices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch services from the specified endpoint
      const res = await fetch(
        `/api/services?endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
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
  }, [endpoint, useTLS, cacheEnabled]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    onMaximize();
  };

  // Extract domain name or IP from endpoint for display
  const getEndpointDisplay = () => {
    try {
      const parts = endpoint.split(':');
      if (parts.length > 1) {
        // Extract hostname without port
        return parts[0];
      }
      return endpoint;
    } catch {
      return endpoint;
    }
  };

  const handleServiceSelect = (service: Service) => {
    onServiceSelect(service);
  };

  const handleMethodSelect = (method: Method, service: Service) => {
    onMethodSelect(method, service, endpoint);
  };

  return (
    <div className={`bg-dark-surface border-b border-dark-border transition-all ${
      isMaximized ? 'flex-grow' : 'flex-none'
    } ${isMinimized ? 'h-12 overflow-hidden' : ''}`}>
      <div className="flex justify-between items-center px-4 py-2 bg-dark-highlight">
        <div className="flex items-center overflow-hidden">
          <div className="flex gap-2 mr-3">
            <button
              className="w-3 h-3 rounded-full bg-error-red hover:bg-opacity-80 transition"
              onClick={onClose}
              title="Close network"
            />
            <button
              className="w-3 h-3 rounded-full bg-warning-yellow hover:bg-opacity-80 transition"
              onClick={onMinimize}
              title={isMinimized ? "Expand network" : "Minimize network"}
            />
            <button
              className="w-3 h-3 rounded-full bg-success-green hover:bg-opacity-80 transition"
              onClick={handleMaximize}
              title={isMaximized ? "Restore size" : "Maximize network"}
            />
          </div>
          <div className="flex items-center truncate">
            <span className="text-xs font-semibold text-blue-accent mr-2">{getEndpointDisplay()}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${useTLS ? 'bg-success-green/20 text-success-green' : 'bg-warning-yellow/20 text-warning-yellow'}`}>
              {useTLS ? 'TLS' : 'Plaintext'}
            </span>
          </div>
        </div>
        <div className="text-xs text-text-secondary truncate ml-2">
          {endpoint}
        </div>
      </div>
      
      {!isMinimized && (
        loading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <LoadingSpinner size="md" />
            <span className="text-text-secondary mt-2">Loading services...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-error-red text-sm">
            {error}
          </div>
        ) : (
          <ServiceList
            services={services}
            selectedService={selectedService}
            selectedMethod={selectedMethod}
            onServiceSelect={handleServiceSelect}
            onMethodSelect={handleMethodSelect}
            endpoint={endpoint}
            defaultExpanded={defaultExpanded}
          />
        )
      )}
    </div>
  );
};

export default NetworkTab;