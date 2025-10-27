'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Network, Play, X, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpandableBlock } from './ExpandableBlock';
import NetworkBlock from './NetworkBlock';
import MethodBlock from './MethodBlock';
import MethodDescriptor from './MethodDescriptor';
import ResultsPanel from './ResultsPanel';
import AddNetworkDialog from './AddNetworkDialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { getFromCache, saveToCache, getServicesCacheKey } from '@/lib/utils/client-cache';

interface GrpcNetwork {
  id: string;
  name: string;
  endpoint: string;
  tlsEnabled: boolean;
  services: GrpcService[];
  color: string;
  loading?: boolean;
  error?: string;
  expanded?: boolean;
}

interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  options?: any;
  description?: string;
}

interface MethodInstance {
  id: string;
  networkId: string;
  method: GrpcMethod;
  service: GrpcService;
  color: string;
  expanded?: boolean;
  params?: Record<string, any>;
}

interface ExecutionResult {
  methodId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  duration?: number;
}

// Color palette for networks
const NETWORK_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#84cc16', // lime
];

export default function GrpcExplorerApp() {
  const [networks, setNetworks] = useState<GrpcNetwork[]>([]);
  const [methodInstances, setMethodInstances] = useState<MethodInstance[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<MethodInstance | null>(null);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get next color for network
  const getNextColor = useCallback(() => {
    const usedColors = networks.map(n => n.color);
    const availableColor = NETWORK_COLORS.find(c => !usedColors.includes(c));
    return availableColor || NETWORK_COLORS[networks.length % NETWORK_COLORS.length];
  }, [networks]);

  // Add network
  const handleAddNetwork = useCallback(async (endpoint: string, tlsEnabled: boolean) => {
    const id = generateId();
    const color = getNextColor();
    const name = endpoint.split('//').pop()?.split(':')[0] || endpoint;

    const newNetwork: GrpcNetwork = {
      id,
      name,
      endpoint,
      tlsEnabled,
      services: [],
      color,
      loading: true,
      expanded: true
    };

    setNetworks(prev => [...prev, newNetwork]);

    // Check client-side cache first
    const cacheKey = getServicesCacheKey(endpoint, tlsEnabled);
    const cached = getFromCache<any>(cacheKey);

    if (cached) {
      console.log(`Using cached services for ${endpoint}`);
      setNetworks(prev => prev.map(n =>
        n.id === id
          ? { ...n, services: cached.services || [], loading: false }
          : n
      ));
      return;
    }

    // Fetch services via reflection
    try {
      const response = await fetch('/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, tlsEnabled })
      });

      if (!response.ok) throw new Error('Failed to fetch services');

      const data = await response.json();

      // Save to client-side cache
      saveToCache(cacheKey, data);

      // Update network with actual endpoint (in case chain marker was used)
      const actualEndpoint = data.status?.endpoint || endpoint;

      setNetworks(prev => prev.map(n =>
        n.id === id
          ? {
              ...n,
              services: data.services || [],
              endpoint: actualEndpoint,  // Use actual endpoint that worked
              loading: false
            }
          : n
      ));
    } catch (error) {
      setNetworks(prev => prev.map(n =>
        n.id === id
          ? { ...n, error: error instanceof Error ? error.message : 'Unknown error', loading: false }
          : n
      ));
    }
  }, [getNextColor]);

  // Remove network
  const handleRemoveNetwork = useCallback((networkId: string) => {
    setNetworks(prev => prev.filter(n => n.id !== networkId));
    setMethodInstances(prev => prev.filter(m => m.networkId !== networkId));
  }, []);

  // Toggle network expansion
  const toggleNetworkExpanded = useCallback((networkId: string) => {
    setNetworks(prev => prev.map(n => 
      n.id === networkId ? { ...n, expanded: !n.expanded } : n
    ));
  }, []);

  // Add method instance to center panel
  const handleSelectMethod = useCallback((network: GrpcNetwork, service: GrpcService, method: GrpcMethod) => {
    // Check if method already exists
    const exists = methodInstances.some(
      m => m.networkId === network.id && 
           m.method.fullName === method.fullName &&
           m.service.fullName === service.fullName
    );

    if (!exists) {
      const newInstance: MethodInstance = {
        id: generateId(),
        networkId: network.id,
        method,
        service,
        color: network.color,
        expanded: true,
        params: {}
      };

      setMethodInstances(prev => [...prev, newInstance]);
      setSelectedMethod(newInstance);
    }
  }, [methodInstances]);

  // Remove method instance
  const handleRemoveMethodInstance = useCallback((instanceId: string) => {
    setMethodInstances(prev => prev.filter(m => m.id !== instanceId));
    if (selectedMethod?.id === instanceId) {
      setSelectedMethod(null);
    }
  }, [selectedMethod]);

  // Toggle method instance expansion
  const toggleMethodExpanded = useCallback((instanceId: string) => {
    setMethodInstances(prev => prev.map(m => 
      m.id === instanceId ? { ...m, expanded: !m.expanded } : m
    ));
  }, []);

  // Update method parameters
  const handleUpdateParams = useCallback((instanceId: string, params: Record<string, any>) => {
    setMethodInstances(prev => prev.map(m => 
      m.id === instanceId ? { ...m, params } : m
    ));
  }, []);

  // Execute method
  const handleExecuteMethod = useCallback(async (instance: MethodInstance) => {
    setIsExecuting(true);
    setSelectedMethod(instance);

    const startTime = Date.now();

    try {
      const network = networks.find(n => n.id === instance.networkId);
      if (!network) throw new Error('Network not found');

      const response = await fetch('/api/grpc/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: network.endpoint,
          tlsEnabled: network.tlsEnabled,
          service: instance.service.fullName,
          method: instance.method.name,
          params: instance.params
        })
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        methodId: instance.id,
        success: response.ok,
        data: data.result || data,
        error: data.error,
        timestamp: Date.now(),
        duration
      };

      setExecutionResults(prev => [result, ...prev].slice(0, 50)); // Keep last 50 results
    } catch (error) {
      const result: ExecutionResult = {
        methodId: instance.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

      setExecutionResults(prev => [result, ...prev].slice(0, 50));
    } finally {
      setIsExecuting(false);
    }
  }, [networks]);

  // Get latest result for selected method
  const currentResult = useMemo(() => {
    if (!selectedMethod) return null;
    return executionResults.find(r => r.methodId === selectedMethod.id);
  }, [selectedMethod, executionResults]);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900">
      {/* Vertical resizable group for top/bottom split */}
      <ResizablePanelGroup direction="vertical" className="h-full">
        {/* Top Panel - Method Descriptor */}
        <ResizablePanel defaultSize={20} minSize={10} maxSize={40}>
          <div className="h-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            {selectedMethod ? (
              <MethodDescriptor
                method={selectedMethod.method}
                service={selectedMethod.service}
                color={selectedMethod.color}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a method to view its descriptor</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="h-2 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors" />

        {/* Bottom Panel - Main Content Area */}
        <ResizablePanel defaultSize={80}>
          {/* Horizontal resizable group for left/center/right split */}
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel - Networks */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div className="h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Networks</h2>
              <button
                onClick={() => setShowAddNetwork(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {networks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Network className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No networks added</p>
                <button
                  onClick={() => setShowAddNetwork(true)}
                  className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Add your first network
                </button>
              </div>
            ) : (
              networks.map(network => (
                <NetworkBlock
                  key={network.id}
                  network={network}
                  onToggle={() => toggleNetworkExpanded(network.id)}
                  onRemove={() => handleRemoveNetwork(network.id)}
                  onSelectMethod={(service, method) => handleSelectMethod(network, service, method)}
                />
              ))
            )}
          </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="w-2 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors" />

            {/* Center Panel - Method Instances */}
            <ResizablePanel defaultSize={40} minSize={20}>
              <div className="h-full border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Method Instances</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {methodInstances.length} active
              </span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {methodInstances.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <ChevronDown className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No methods selected</p>
                <p className="text-xs mt-1">Select methods from the networks panel</p>
              </div>
            ) : (
              methodInstances.map(instance => (
                <MethodBlock
                  key={instance.id}
                  instance={instance}
                  isSelected={selectedMethod?.id === instance.id}
                  onToggle={() => toggleMethodExpanded(instance.id)}
                  onRemove={() => handleRemoveMethodInstance(instance.id)}
                  onSelect={() => setSelectedMethod(instance)}
                  onUpdateParams={(params) => handleUpdateParams(instance.id, params)}
                  onExecute={() => handleExecuteMethod(instance)}
                  isExecuting={isExecuting && selectedMethod?.id === instance.id}
                />
              ))
            )}
          </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="w-2 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors" />

            {/* Right Panel - Results */}
            <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
              <div className="h-full bg-white dark:bg-gray-950 overflow-hidden">
                <ResultsPanel
                  result={currentResult || null}
                  isExecuting={isExecuting}
                  selectedMethod={selectedMethod}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Add Network Dialog */}
      {showAddNetwork && (
        <AddNetworkDialog
          onAdd={handleAddNetwork}
          onClose={() => setShowAddNetwork(false)}
        />
      )}
    </div>
  );
}