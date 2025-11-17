'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Network, Play, X, Loader2, Copy, Check, ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpandableBlock } from './ExpandableBlock';
import NetworkBlock from './NetworkBlock';
import MethodBlock from './MethodBlock';
import MethodDescriptor from './MethodDescriptor';
import ResultsPanel from './ResultsPanel';
import AddNetworkDialog from './AddNetworkDialog';
import MenuBar from './MenuBar';
import HelpDialog from './HelpDialog';
import SettingsDialog from './SettingsDialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { getFromCache, saveToCache, getServicesCacheKey } from '@/lib/utils/client-cache';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { debug } from '@/lib/utils/debug';
import { GrpcNetwork, GrpcService, GrpcMethod, MethodInstance, ExecutionResult } from '@/lib/types/grpc';

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
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [descriptorSize, setDescriptorSize] = useState<'expanded' | 'small' | 'minimized'>('expanded');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [autoCollapseEnabled, setAutoCollapseEnabled] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  const [isOverlayMode, setIsOverlayMode] = useState(false);

  // Load persisted networks from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('grpc-explorer-networks');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid (use same TTL as services)
        const ttl = parseInt(localStorage.getItem('grpc-cache-ttl') || '3600000'); // Default 1 hour
        const isValid = parsed.networks && Array.isArray(parsed.networks) &&
                       parsed.timestamp && (Date.now() - parsed.timestamp < ttl);

        if (isValid) {
          console.log(`[NetworkCache] Restored ${parsed.networks.length} networks from cache`);
          setNetworks(parsed.networks);
        } else {
          console.log('[NetworkCache] Cache expired or invalid, starting fresh');
          localStorage.removeItem('grpc-explorer-networks');
        }
      }
    } catch (err) {
      console.error('[NetworkCache] Failed to restore networks:', err);
    }
  }, []);

  // Persist networks to localStorage whenever they change
  useEffect(() => {
    if (networks.length > 0) {
      try {
        localStorage.setItem('grpc-explorer-networks', JSON.stringify({
          networks,
          timestamp: Date.now(),
        }));
        console.log(`[NetworkCache] Saved ${networks.length} networks to cache`);
      } catch (err) {
        console.error('[NetworkCache] Failed to save networks:', err);
      }
    }
  }, [networks]);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Window resize handler for responsive left panel
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);

      // Auto-collapse threshold: 1024px
      const collapseThreshold = 1024;

      if (width < collapseThreshold && !leftPanelCollapsed) {
        // Window is narrow, collapse the panel
        setLeftPanelCollapsed(true);
        setIsOverlayMode(false);
      } else if (width >= collapseThreshold && leftPanelCollapsed && !isOverlayMode) {
        // Window is wide enough, restore panel if it was auto-collapsed
        // (but not if user manually collapsed it in overlay mode)
        setLeftPanelCollapsed(false);
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [leftPanelCollapsed, isOverlayMode]);

  // Calculate responsive left panel width
  const getLeftPanelWidth = () => {
    // Base width: 420px for comfortable method name reading
    // As window narrows from 1600px to 1024px, shrink from 420px to 320px
    if (windowWidth >= 1600) return 420;
    if (windowWidth < 1024) return 320;

    // Linear interpolation between 1600px and 1024px window width
    const ratio = (windowWidth - 1024) / (1600 - 1024);
    return Math.round(320 + (100 * ratio));
  };

  // Handle left panel toggle
  const handleLeftPanelToggle = () => {
    const collapseThreshold = 1024;

    if (windowWidth < collapseThreshold) {
      // Narrow window: use overlay mode
      if (leftPanelCollapsed) {
        setLeftPanelCollapsed(false);
        setIsOverlayMode(true);
      } else {
        setLeftPanelCollapsed(true);
        setIsOverlayMode(false);
      }
    } else {
      // Wide window: normal toggle
      setLeftPanelCollapsed(!leftPanelCollapsed);
      setIsOverlayMode(false);
    }
  };

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
      handler: () => setShowHelp(true),
      description: 'Show help and shortcuts'
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
    // Check client-side cache first to get chain-id for deduplication
    const cacheKey = getServicesCacheKey(endpoint, tlsEnabled);
    const cached = getFromCache<any>(cacheKey);
    const cachedChainId = cached?.chainId || cached?.status?.chainId;

    // If we have cached data, use it immediately
    if (cached) {
      debug.log(`✓ Using cached services for ${endpoint} (cached ${Math.round((Date.now() - (cached.timestamp || 0)) / 1000 / 60)} mins ago)`);

      const actualEndpoint = cached.status?.endpoint || endpoint;
      const existingNetwork = cachedChainId
        ? networks.find(n => n.chainId === cachedChainId)
        : null;

      if (existingNetwork && cachedChainId) {
        // Same chain detected - add endpoint to existing network instead of duplicating
        debug.log(`⚠️  Chain ${cachedChainId} already exists, adding ${actualEndpoint} as fallback endpoint`);

        setNetworks(prev => prev.map(n =>
          n.id === existingNetwork.id
            ? {
                ...n,
                endpoints: [...(n.endpoints || []), actualEndpoint],
                expanded: true // Expand to show user we recognized the duplicate
              }
            : autoCollapseEnabled ? { ...n, expanded: false } : n
        ));

        console.log(`[NetworkCache] Added ${actualEndpoint} as fallback for chain ${cachedChainId}`);
        return;
      }

      // New chain with cached data - add immediately
      const id = generateId();
      const color = getNextColor();
      const name = actualEndpoint.split('//').pop()?.split(':')[0] || actualEndpoint;

      const newNetwork: GrpcNetwork = {
        id,
        name,
        endpoint: actualEndpoint,
        endpoints: [],
        ...(cachedChainId ? { chainId: cachedChainId } : {}),
        tlsEnabled,
        services: cached.services || [],
        color,
        loading: false,
        cached: true,
        cacheTimestamp: cached.timestamp || Date.now(),
        expanded: true
      };

      setNetworks(prev => {
        if (autoCollapseEnabled) {
          return [...prev.map(n => ({ ...n, expanded: false })), newNetwork];
        }
        return [...prev, newNetwork];
      });
      return;
    }

    // No cache - add network with loading state, then fetch
    debug.log(`⟳ Fetching fresh services from ${endpoint}...`);

    const id = generateId();
    const color = getNextColor();
    const name = endpoint.split('//').pop()?.split(':')[0] || endpoint;

    const newNetwork: GrpcNetwork = {
      id,
      name,
      endpoint,
      endpoints: [],
      tlsEnabled,
      services: [],
      color,
      loading: true,
      cached: false,
      cacheTimestamp: Date.now(),
      expanded: true
    };

    // Add network to UI immediately with loading state
    setNetworks(prev => {
      if (autoCollapseEnabled) {
        return [...prev.map(n => ({ ...n, expanded: false })), newNetwork];
      }
      return [...prev, newNetwork];
    });

    // Fetch data in background
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

      const actualEndpoint = data.status?.endpoint || endpoint;
      const fetchedChainId = data.chainId || data.status?.chainId;

      debug.log(`✓ Fetched ${data.services?.length || 0} services from ${actualEndpoint}`);

      // Check if this chain already exists (might have been added while we were fetching)
      const existingNetwork = fetchedChainId
        ? networks.find(n => n.chainId === fetchedChainId && n.id !== id)
        : null;

      if (existingNetwork && fetchedChainId) {
        // Same chain detected - remove the loading network and add as fallback instead
        debug.log(`⚠️  Chain ${fetchedChainId} already exists, converting to fallback endpoint`);

        setNetworks(prev => prev.map(n =>
          n.id === existingNetwork.id
            ? {
                ...n,
                endpoints: [...(n.endpoints || []), actualEndpoint],
                expanded: true
              }
            : n.id === id
              ? null // Remove the loading network
              : autoCollapseEnabled ? { ...n, expanded: false } : n
        ).filter((n): n is GrpcNetwork => n !== null));

        console.log(`[NetworkCache] Added ${actualEndpoint} as fallback for chain ${fetchedChainId}`);
        return;
      }

      // Update network with fetched data
      setNetworks(prev => prev.map(n =>
        n.id === id
          ? {
              ...n,
              services: data.services || [],
              endpoint: actualEndpoint,
              ...(fetchedChainId ? { chainId: fetchedChainId } : {}),
              loading: false,
              cached: false,
              cacheTimestamp: now
            }
          : n
      ));
    } catch (error) {
      debug.error(`Failed to fetch from ${endpoint}:`, error);
      setNetworks(prev => prev.map(n =>
        n.id === id
          ? { ...n, error: error instanceof Error ? error.message : 'Unknown error', loading: false }
          : n
      ));
    }
  }, [networks, getNextColor, autoCollapseEnabled]);

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

    debug.log(`🔄 Force refreshing ${network.endpoint}...`);

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
      const chainId = data.chainId || data.status?.chainId;
      debug.log(`✓ Refreshed ${data.services?.length || 0} services from ${actualEndpoint}`);

      setNetworks(prev => prev.map(n => {
        if (n.id === networkId) {
          const { error, ...rest } = n;
          return {
            ...rest,
            services: data.services || [],
            endpoint: actualEndpoint,
            chainId,
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
    setNetworks(prev => {
      const targetNetwork = prev.find(n => n.id === networkId);
      if (!targetNetwork) return prev;

      const isExpanding = !targetNetwork.expanded;

      // If expanding and auto-collapse is enabled, collapse other networks
      if (isExpanding && autoCollapseEnabled) {
        return prev.map(n =>
          n.id === networkId
            ? { ...n, expanded: true }
            : { ...n, expanded: false }
        );
      }

      // Otherwise, just toggle this network
      return prev.map(n =>
        n.id === networkId ? { ...n, expanded: !n.expanded } : n
      );
    });
  }, [autoCollapseEnabled]);

  // Add method instance to center panel
  const handleSelectMethod = useCallback((network: GrpcNetwork, service: GrpcService, method: GrpcMethod) => {
    // Check if method already exists
    const existingIndex = methodInstances.findIndex(
      m => m.networkId === network.id &&
           m.method.fullName === method.fullName &&
           m.service.fullName === service.fullName
    );

    if (existingIndex >= 0) {
      // Method exists, select it and auto-collapse others if enabled
      const existingInstance = methodInstances[existingIndex];

      if (autoCollapseEnabled && !existingInstance.expanded) {
        // If auto-collapse is enabled and we're expanding this method, collapse unpinned methods
        setMethodInstances(prev => prev.map(m =>
          m.id === existingInstance.id
            ? { ...m, expanded: true }
            : (m.pinned ? m : { ...m, expanded: false })
        ));
      }

      setSelectedMethod(existingInstance);
    } else {
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

      // Auto-collapse unpinned methods if enabled
      setMethodInstances(prev => {
        if (autoCollapseEnabled) {
          return [...prev.map(m => m.pinned ? m : { ...m, expanded: false }), newInstance];
        }
        return [...prev, newInstance];
      });

      setSelectedMethod(newInstance);
    }
  }, [methodInstances, autoCollapseEnabled]);

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
    setMethodInstances(prev => {
      const targetMethod = prev.find(m => m.id === instanceId);
      if (!targetMethod) return prev;

      const isExpanding = !targetMethod.expanded;

      // If expanding and auto-collapse is enabled, collapse other unpinned methods
      if (isExpanding && autoCollapseEnabled) {
        return prev.map(m =>
          m.id === instanceId
            ? { ...m, expanded: true }
            : (m.pinned ? m : { ...m, expanded: false })
        );
      }

      // Otherwise, just toggle this method
      return prev.map(m =>
        m.id === instanceId ? { ...m, expanded: !m.expanded } : m
      );
    });
  }, [autoCollapseEnabled]);

  // Toggle method pin status
  const toggleMethodPin = useCallback((instanceId: string) => {
    setMethodInstances(prev => prev.map(m =>
      m.id === instanceId ? { ...m, pinned: !m.pinned } : m
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
    <div className="h-screen bg-background flex relative">
      {/* Left Panel - Networks (Full Height) - Collapsible */}
      <div
        className={cn(
          "border-r border-border bg-card flex flex-col transition-all duration-300",
          leftPanelCollapsed ? "w-12" : "",
          isOverlayMode && !leftPanelCollapsed && "absolute top-0 left-0 h-full z-50 shadow-2xl"
        )}
        style={
          !leftPanelCollapsed && !isOverlayMode
            ? { width: `${getLeftPanelWidth()}px` }
            : isOverlayMode && !leftPanelCollapsed
            ? { width: '420px' }
            : undefined
        }
      >
        <div className="sticky top-0 z-10 bg-card border-b border-border">
          <div className="flex items-center justify-between p-4">
            {!leftPanelCollapsed && (
              <h2 className="text-sm font-semibold text-foreground">Networks</h2>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={handleLeftPanelToggle}
                className="p-1.5 hover:bg-secondary/50 rounded-lg transition-colors"
                title={leftPanelCollapsed ? "Show networks panel" : "Hide networks panel"}
                aria-label={leftPanelCollapsed ? "Show networks panel" : "Hide networks panel"}
              >
                {leftPanelCollapsed ? (
                  <ChevronRight className="h-5 w-5 text-foreground" />
                ) : (
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                )}
              </button>
              {!leftPanelCollapsed && (
                <button
                  onClick={() => setShowAddNetwork(true)}
                  className="p-1.5 hover:bg-secondary/50 rounded-lg transition-colors"
                  title="Add network"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {!leftPanelCollapsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {networks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No networks added</p>
                <button
                  onClick={() => setShowAddNetwork(true)}
                  className="mt-3 text-xs text-primary hover:underline"
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
        )}
      </div>

      {/* Backdrop for overlay mode */}
      {isOverlayMode && !leftPanelCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/50 light:bg-black/30 z-40 transition-opacity duration-300"
          onClick={handleLeftPanelToggle}
        />
      )}

      {/* Right Column - Menu, Descriptor, and Center/Right Panels */}
      <div className="flex-1 flex flex-col">
        {/* Menu Bar */}
        <MenuBar
          onShowHelp={() => setShowHelp(true)}
          onShowSettings={() => setShowSettings(true)}
        />

        {/* Method Descriptor - Three size states */}
        {descriptorSize !== 'minimized' && (
          <div className="border-b border-border bg-card">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Method Descriptor
              </h3>
              <div className="flex items-center gap-1">
                {descriptorSize === 'expanded' && (
                  <button
                    onClick={() => setDescriptorSize('small')}
                    className="p-1 hover:bg-secondary/50 rounded transition-colors"
                    title="Make descriptor smaller"
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {descriptorSize === 'small' && (
                  <>
                    <button
                      onClick={() => setDescriptorSize('expanded')}
                      className="p-1 hover:bg-secondary/50 rounded transition-colors"
                      title="Expand descriptor"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setDescriptorSize('minimized')}
                      className="p-1 hover:bg-secondary/50 rounded transition-colors"
                      title="Minimize descriptor"
                    >
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
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
                  "flex items-center justify-center text-muted-foreground",
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
          <div className="border-b border-border bg-card">
            <button
              onClick={() => setDescriptorSize('small')}
              className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-secondary/50 transition-colors"
              title="Expand descriptor panel"
            >
              <span className="text-xs text-muted-foreground">
                {selectedMethod ? `${selectedMethod.service.name}.${selectedMethod.method.name}` : 'Method Descriptor'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Center and Right Panels */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Center Panel - Method Instances */}
            <ResizablePanel defaultSize={33} minSize={25} id="methods-panel" order={1} collapsible={false}>
              <div className="h-full border-r border-border bg-background overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center justify-between p-4">
              <h2 className="text-sm font-semibold text-foreground">Method Instances</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {methodInstances.length} active
                </span>
                {methodInstances.length > 0 && (
                  <button
                    onClick={handleClearAllMethods}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {methodInstances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
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
                  onTogglePin={() => toggleMethodPin(instance.id)}
                  isExecuting={isExecuting && selectedMethod?.id === instance.id}
                />
              ))
            )}
          </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="w-2 bg-border hover:bg-primary transition-colors" />

            {/* Right Panel - Results */}
            <ResizablePanel defaultSize={67} minSize={30} maxSize={80} id="results-panel" order={2} collapsible={false}>
              <div className="h-full w-full bg-card flex flex-col">
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

      {/* Dialogs */}
      {showAddNetwork && (
        <AddNetworkDialog
          onAdd={handleAddNetwork}
          onClose={() => setShowAddNetwork(false)}
        />
      )}

      <HelpDialog
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        autoCollapseEnabled={autoCollapseEnabled}
        onAutoCollapseChange={setAutoCollapseEnabled}
      />
    </div>
  );
}