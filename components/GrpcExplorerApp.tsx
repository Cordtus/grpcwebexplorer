'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Network, Play, X, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpandableBlock } from './ExpandableBlock';
import NetworkBlock from './NetworkBlock';
import MethodBlock from './MethodBlock';
import MethodDescriptor from './MethodDescriptor';
import ResultsPanel from './ResultsPanel';
import AddNetworkDialog from './AddNetworkDialog';
import MenuBar from './MenuBar';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';
import SettingsDialog from './SettingsDialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { getFromCache, saveToCache, getServicesCacheKey } from '@/lib/utils/client-cache';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { MessageTypeDefinition } from './ProtobufFormGenerator';

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
  cached?: boolean;
  cacheTimestamp?: number;
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
  requestTypeDefinition: MessageTypeDefinition;
  responseTypeDefinition: MessageTypeDefinition;
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
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [descriptorSize, setDescriptorSize] = useState<'expanded' | 'small' | 'minimized'>('expanded');

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Register keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      handler: () => setShowAddNetwork(true),
      description: 'Add new network'
    },
    {
      key: 'w',
      ctrl: true,
      handler: () => {
        if (selectedMethod) {
          handleRemoveMethodInstance(selectedMethod.id);
        }
      },
      description: 'Close current tab'
    },
    {
      key: 'Enter',
      ctrl: true,
      handler: () => {
        if (selectedMethod && !isExecuting) {
          handleExecuteMethod(selectedMethod);
        }
      },
      description: 'Execute method'
    },
    {
      key: '?',
      ctrl: true,
      shift: true,
      handler: () => setShowKeyboardShortcuts(true),
      description: 'Show keyboard shortcuts'
    }
  ]);

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
      console.log(`✓ Using cached services for ${endpoint} (cached ${Math.round((Date.now() - (cached.timestamp || 0)) / 1000 / 60)} mins ago)`);
      setNetworks(prev => prev.map(n =>
        n.id === id
          ? {
              ...n,
              services: cached.services || [],
              loading: false,
              cached: true,
              cacheTimestamp: cached.timestamp || Date.now()
            }
          : n
      ));
      return;
    }

    // Fetch services via reflection
    console.log(`⟳ Fetching fresh services from ${endpoint}...`);
    try {
      const response = await fetch('/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, tlsEnabled })
      });

      if (!response.ok) throw new Error('Failed to fetch services');

      const data = await response.json();
      const now = Date.now();

      // Save to client-side cache with timestamp
      saveToCache(cacheKey, { ...data, timestamp: now });

      // Update network with actual endpoint (in case chain marker was used)
      const actualEndpoint = data.status?.endpoint || endpoint;

      console.log(`✓ Fetched ${data.services?.length || 0} services from ${actualEndpoint}`);

      setNetworks(prev => prev.map(n =>
        n.id === id
          ? {
              ...n,
              services: data.services || [],
              endpoint: actualEndpoint,  // Use actual endpoint that worked
              loading: false,
              cached: false,
              cacheTimestamp: now
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

  // Refresh network (force fetch from server, bypass cache)
  const handleRefreshNetwork = useCallback(async (networkId: string) => {
    const network = networks.find(n => n.id === networkId);
    if (!network) return;

    // Clear cache for this endpoint
    const cacheKey = getServicesCacheKey(network.endpoint, network.tlsEnabled);
    const { removeFromCache } = await import('@/lib/utils/client-cache');
    removeFromCache(cacheKey);

    console.log(`🔄 Force refreshing ${network.endpoint}...`);

    // Set loading state
    setNetworks(prev => prev.map(n => {
      if (n.id === networkId) {
        const { error, ...rest } = n;
        return { ...rest, loading: true };
      }
      return n;
    }));

    // Fetch fresh data
    try {
      const response = await fetch('/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: network.endpoint,
          tlsEnabled: network.tlsEnabled,
          forceRefresh: true
        })
      });

      if (!response.ok) throw new Error('Failed to fetch services');

      const data = await response.json();
      const now = Date.now();

      // Save to cache
      const { saveToCache } = await import('@/lib/utils/client-cache');
      saveToCache(cacheKey, { ...data, timestamp: now });

      const actualEndpoint = data.status?.endpoint || network.endpoint;
      console.log(`✓ Refreshed ${data.services?.length || 0} services from ${actualEndpoint}`);

      setNetworks(prev => prev.map(n => {
        if (n.id === networkId) {
          const { error, ...rest } = n;
          return {
            ...rest,
            services: data.services || [],
            endpoint: actualEndpoint,
            loading: false,
            cached: false,
            cacheTimestamp: now
          };
        }
        return n;
      }));
    } catch (error) {
      console.error(`✗ Refresh failed for ${network.endpoint}:`, error);
      setNetworks(prev => prev.map(n =>
        n.id === networkId
          ? {
              ...n,
              error: error instanceof Error ? error.message : 'Refresh failed',
              loading: false
            }
          : n
      ));
    }
  }, [networks]);

  // Toggle network expansion
  const toggleNetworkExpanded = useCallback((networkId: string) => {
    setNetworks(prev => prev.map(n =>
      n.id === networkId ? { ...n, expanded: !n.expanded } : n
    ));
  }, []);

  // Add method instance to center panel
  const handleSelectMethod = useCallback((network: GrpcNetwork, service: GrpcService, method: GrpcMethod) => {
    // Check if method already exists
    const existingIndex = methodInstances.findIndex(
      m => m.networkId === network.id &&
           m.method.fullName === method.fullName &&
           m.service.fullName === service.fullName
    );

    if (existingIndex >= 0) {
      // Method exists, just select it
      setSelectedMethod(methodInstances[existingIndex]);
    } else {
      // Collapse all existing methods
      setMethodInstances(prev => prev.map(m => ({ ...m, expanded: false })));

      // Add new method expanded
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

  // Clear all method instances
  const handleClearAllMethods = useCallback(() => {
    setMethodInstances([]);
    setSelectedMethod(null);
  }, []);

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
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row">
      {/* Networks Panel - Collapsible on mobile, sidebar on desktop */}
      <div className="w-full lg:w-[30%] lg:min-w-[20%] lg:max-w-[50%] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col max-h-[40vh] lg:max-h-none overflow-hidden">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Networks</h2>
              <button
                onClick={() => setShowAddNetwork(true)}
                className="p-2.5 lg:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5 lg:h-4 lg:w-4" />
              </button>
            </div>
          </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                onRefresh={() => handleRefreshNetwork(network.id)}
                onSelectMethod={(service, method) => handleSelectMethod(network, service, method)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Column - Menu, Descriptor, and Center/Right Panels */}
      <div className="flex-1 flex flex-col">
        {/* Menu Bar */}
        <MenuBar
          onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
          onShowSettings={() => setShowSettings(true)}
        />

        {/* Method Descriptor - Three size states */}
        {descriptorSize !== 'minimized' && (
          <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Method Descriptor
              </h3>
              <div className="flex items-center gap-1">
                {descriptorSize === 'expanded' && (
                  <button
                    onClick={() => setDescriptorSize('small')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Make descriptor smaller"
                  >
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  </button>
                )}
                {descriptorSize === 'small' && (
                  <>
                    <button
                      onClick={() => setDescriptorSize('expanded')}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                      title="Expand descriptor"
                    >
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setDescriptorSize('minimized')}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                      title="Minimize descriptor"
                    >
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className={cn(
              "overflow-y-auto",
              descriptorSize === 'expanded' ? 'max-h-96' : 'max-h-48'
            )}>
              {selectedMethod ? (() => {
                const network = networks.find(n => n.id === selectedMethod.networkId);
                return (
                  <MethodDescriptor
                    method={selectedMethod.method}
                    service={selectedMethod.service}
                    color={selectedMethod.color}
                    {...(network?.endpoint && { endpoint: network.endpoint })}
                    {...(network?.tlsEnabled !== undefined && { tlsEnabled: network.tlsEnabled })}
                  />
                );
              })() : (
                <div className={cn(
                  "flex items-center justify-center text-gray-500 dark:text-gray-400",
                  descriptorSize === 'expanded' ? 'h-64' : 'h-32'
                )}>
                  <div className="text-center">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Select a method to view its descriptor</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Minimized bar when panel is minimized */}
        {descriptorSize === 'minimized' && (
          <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
            <button
              onClick={() => setDescriptorSize('small')}
              className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              title="Expand descriptor panel"
            >
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedMethod ? `${selectedMethod.service.name}.${selectedMethod.method.name}` : 'Method Descriptor'}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        )}

        {/* Center and Right Panels - Stacked on mobile, side-by-side on desktop */}
        <div className="flex-1 min-h-0 flex flex-col lg:block">
          {/* Mobile: Stacked layout */}
          <div className="flex flex-col flex-1 lg:hidden">
            {/* Method Instances - Mobile */}
            <div className="flex-1 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto min-h-[30vh]">
          <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Method Instances</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {methodInstances.length} active
                </span>
                {methodInstances.length > 0 && (
                  <button
                    onClick={handleClearAllMethods}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
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

            {/* Results - Mobile */}
            <div className="flex-1 bg-white dark:bg-gray-950 overflow-hidden min-h-[30vh]">
              <ResultsPanel
                result={currentResult || null}
                isExecuting={isExecuting}
                selectedMethod={selectedMethod}
              />
            </div>
          </div>

          {/* Desktop: Resizable panels */}
          <div className="hidden lg:block h-full">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* Method Instances - Desktop */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
                  <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between p-4">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Method Instances</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {methodInstances.length} active
                        </span>
                        {methodInstances.length > 0 && (
                          <button
                            onClick={handleClearAllMethods}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
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

              {/* Results - Desktop */}
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
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showAddNetwork && (
        <AddNetworkDialog
          onAdd={handleAddNetwork}
          onClose={() => setShowAddNetwork(false)}
        />
      )}

      <KeyboardShortcutsDialog
        open={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}