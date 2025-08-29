import React, { useState, useEffect, useCallback } from 'react';
import ServiceList from './ServiceList';
import LoadingSpinner from './LoadingSpinner';
import { RefreshCw } from 'lucide-react';
import { useTabManager } from '@/lib/contexts/TabManager';
import { cn } from '@/lib/utils';

export interface NetworkTabProps {
  endpoint: string;
  tlsEnabled: boolean;
  onServiceSelect: (service: string) => void;
  onMethodSelect: (method: string) => void;
}

const NetworkTab: React.FC<NetworkTabProps> = ({
  endpoint,
  tlsEnabled,
  onServiceSelect,
  onMethodSelect,
}) => {
  const { updateTab, activeTabId } = useTabManager();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<any | null>(null);

  const fetchServices = useCallback(async () => {
    if (!endpoint) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, useTLS: tlsEnabled }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch services: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setServices(data.services || []);
      
      if (activeTabId) {
        updateTab(activeTabId, { services: data.services || [] });
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, tlsEnabled, activeTabId, updateTab]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    onServiceSelect(service.service);
  };

  const handleMethodSelect = (method: any, service: any) => {
    setSelectedMethod(method);
    setSelectedService(service);
    onServiceSelect(service.service);
    onMethodSelect(method.name);
    
    if (activeTabId) {
      updateTab(activeTabId, { 
        selectedMethod: { service: service.service, method: method.name }
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="glass-subtle border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate text-foreground/90" title={endpoint}>
              {(() => {
                try {
                  return new URL(endpoint).hostname;
                } catch {
                  return endpoint;
                }
              })()}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                tlsEnabled 
                  ? "bg-green-500/20 text-green-400" 
                  : "bg-yellow-500/20 text-yellow-400"
              )}>
                {tlsEnabled ? 'TLS' : 'No TLS'}
              </div>
            </div>
          </div>
          <button
            onClick={fetchServices}
            disabled={loading}
            className="btn-ghost p-2 rounded-md"
          >
            <RefreshCw className={cn(
              "h-4 w-4",
              loading && "spinner"
            )} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin p-4">
        {loading && (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No services found</p>
          </div>
        )}

        {!loading && !error && services.length > 0 && (
          <ServiceList
            services={services}
            onServiceSelect={handleServiceSelect}
            onMethodSelect={handleMethodSelect}
            selectedService={selectedService}
            selectedMethod={selectedMethod}
          />
        )}
      </div>
    </div>
  );
};

export default NetworkTab;