'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Plus, Keyboard, History } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { getNetworkColor, MethodTab } from '@/lib/utils/colors';
import { useKeyboardShortcuts, SHORTCUTS } from '@/lib/hooks/useKeyboardShortcuts';
import { useExecutionHistory } from '@/lib/hooks/useExecutionHistory';
import NetworkPanel from './NetworkPanel';
import MethodTabsPanel from './MethodTabsPanel';
import MethodInteractionPanel from './MethodInteractionPanel';
import AddNetworkDialog from './AddNetworkDialog';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';
import ExecutionHistoryDialog from './ExecutionHistoryDialog';

interface NetworkData {
  id: string;
  name: string;
  endpoint: string;
  tlsEnabled: boolean;
  services: any[];
  color: ReturnType<typeof getNetworkColor>;
  loading?: boolean;
  error?: string;
}

const GrpcExplorerApp: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkData[]>([]);
  const [methodTabs, setMethodTabs] = useState<MethodTab[]>([]);
  const [activeMethodTabId, setActiveMethodTabId] = useState<string | null>(null);
  const [methodDescriptors, setMethodDescriptors] = useState<Record<string, any>>({});
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const { history, addExecution, clearHistory, exportHistory } = useExecutionHistory();
  
  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add a new network
  const addNetwork = useCallback(async (endpoint: string, tlsEnabled: boolean = true) => {
    const id = generateId();
    const name = (() => {
      try {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`);
        return url.hostname;
      } catch {
        return endpoint.split(':')[0];
      }
    })();
    
    const newNetwork: NetworkData = {
      id,
      name,
      endpoint,
      tlsEnabled,
      services: [],
      color: getNetworkColor(networks.length),
      loading: true,
    };
    
    setNetworks(prev => [...prev, newNetwork]);
    
    // Fetch services for this network
    try {
      const response = await fetch('/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, useTLS: tlsEnabled }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch services');
      
      const data = await response.json();
      
      // Transform services to include full path in methods
      const transformedServices = (data.services || []).map((service: any) => ({
        ...service,
        methods: service.methods?.map((method: any) => ({
          ...method,
          fullPath: `${service.service}.${method.name}`
        }))
      }));
      
      setNetworks(prev => prev.map(n => 
        n.id === id 
          ? { ...n, services: transformedServices, loading: false }
          : n
      ));
    } catch (error) {
      setNetworks(prev => prev.map(n => 
        n.id === id 
          ? { ...n, error: error instanceof Error ? error.message : 'Failed to load', loading: false }
          : n
      ));
    }
  }, [networks.length]);
  
  // Remove a network
  const removeNetwork = useCallback((networkId: string) => {
    setNetworks(prev => prev.filter(n => n.id !== networkId));
    // Also remove any method tabs from this network
    setMethodTabs(prev => prev.filter(t => t.networkId !== networkId));
  }, []);
  
  // Refresh a network's services
  const refreshNetwork = useCallback(async (networkId: string) => {
    const network = networks.find(n => n.id === networkId);
    if (!network) return;
    
    setNetworks(prev => prev.map(n => 
      n.id === networkId ? { ...n, loading: true } : n
    ));
    
    try {
      const response = await fetch('/api/grpc/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: network.endpoint, useTLS: network.tlsEnabled }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch services');
      
      const data = await response.json();
      
      // Transform services
      const transformedServices = (data.services || []).map((service: any) => ({
        ...service,
        methods: service.methods?.map((method: any) => ({
          ...method,
          fullPath: `${service.service}.${method.name}`
        }))
      }));
      
      setNetworks(prev => prev.map(n => 
        n.id === networkId 
          ? { ...n, services: transformedServices, loading: false }
          : n
      ));
    } catch (error) {
      setNetworks(prev => prev.map(n => 
        n.id === networkId 
          ? { ...n, error: error instanceof Error ? error.message : 'Failed to load', loading: false }
          : n
      ));
    }
  }, [networks]);
  
  // Handle method selection
  const handleMethodSelect = useCallback((network: NetworkData, service: any, method: any) => {
    const tabId = `${network.id}-${service.service}-${method.name}`;
    
    // Check if tab already exists
    const existingTab = methodTabs.find(t => t.id === tabId);
    if (existingTab) {
      setActiveMethodTabId(tabId);
      return;
    }
    
    // Create new tab
    const newTab: MethodTab = {
      id: tabId,
      networkId: network.id,
      networkName: network.name,
      service: service.service,
      method: method.name,
      fullPath: method.fullPath || `${service.service}.${method.name}`,
      color: network.color,
    };
    
    setMethodTabs(prev => [...prev, newTab]);
    setActiveMethodTabId(tabId);
    
    // TODO: Fetch method descriptor
    // For now, using mock data
    setMethodDescriptors(prev => ({
      ...prev,
      [tabId]: {
        request: { 
          example_field: "string",
          nested: { field: "value" }
        },
        response: { 
          result: "string",
          data: ["array"] 
        },
        streaming: false
      }
    }));
  }, [methodTabs]);
  
  // Close a method tab
  const closeMethodTab = useCallback((tabId: string) => {
    setMethodTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeMethodTabId === tabId) {
      setActiveMethodTabId(methodTabs[0]?.id || null);
    }
  }, [activeMethodTabId, methodTabs]);
  
  // Execute a method
  const executeMethod = useCallback(async (params: any) => {
    const activeTab = methodTabs.find(t => t.id === activeMethodTabId);
    if (!activeTab) throw new Error('No active method');
    
    const network = networks.find(n => n.id === activeTab.networkId);
    if (!network) throw new Error('Network not found');
    
    const startTime = Date.now();
    
    // TODO: Make actual gRPC call
    // For now, return mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        const response = {
          success: true,
          data: {
            message: `Response from ${activeTab.method}`,
            timestamp: new Date().toISOString(),
            params: params,
            network: network.name,
            service: activeTab.service
          }
        };
        
        // Add to execution history
        addExecution({
          network: network.name,
          service: activeTab.service,
          method: activeTab.method,
          params: params,
          response: response,
          duration: Date.now() - startTime
        });
        
        resolve(response);
      }, 1000);
    });
  }, [activeMethodTabId, methodTabs, networks, addExecution]);
  
  const activeMethod = methodTabs.find(t => t.id === activeMethodTabId) || null;
  
  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      handler: () => setShowAddNetwork(true),
      description: SHORTCUTS.ADD_NETWORK.description
    },
    {
      key: 'w',
      ctrl: true,
      handler: () => {
        if (activeMethodTabId) {
          closeMethodTab(activeMethodTabId);
        }
      },
      description: SHORTCUTS.CLOSE_TAB.description
    },
    {
      key: 'Tab',
      ctrl: true,
      handler: () => {
        const currentIndex = methodTabs.findIndex(t => t.id === activeMethodTabId);
        const nextIndex = (currentIndex + 1) % methodTabs.length;
        if (methodTabs[nextIndex]) {
          setActiveMethodTabId(methodTabs[nextIndex].id);
        }
      },
      description: SHORTCUTS.NEXT_TAB.description
    },
    {
      key: 'Tab',
      ctrl: true,
      shift: true,
      handler: () => {
        const currentIndex = methodTabs.findIndex(t => t.id === activeMethodTabId);
        const prevIndex = currentIndex === 0 ? methodTabs.length - 1 : currentIndex - 1;
        if (methodTabs[prevIndex]) {
          setActiveMethodTabId(methodTabs[prevIndex].id);
        }
      },
      description: SHORTCUTS.PREV_TAB.description
    },
    {
      key: '?',
      ctrl: true,
      shift: true,
      handler: () => setShowShortcuts(!showShortcuts),
      description: 'Toggle shortcuts help'
    }
  ]);
  
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <Image
            src="/icon.png"
            alt="gRPC Explorer"
            width={20}
            height={20}
            className="shrink-0"
          />
          <h1 className="text-sm font-semibold">gRPC Explorer</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className={cn(
              "p-1.5 rounded",
              "hover:bg-secondary/50 transition-colors",
              "relative"
            )}
            title="Execution history"
          >
            <History className="h-4 w-4" />
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className={cn(
              "p-1.5 rounded",
              "hover:bg-secondary/50 transition-colors"
            )}
            title="Keyboard shortcuts (Ctrl+Shift+?)"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddNetwork(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded text-sm",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "transition-colors"
            )}
          >
            <Plus className="h-4 w-4" />
            Add Network
          </button>
        </div>
      </header>
      
      {/* Main Content - 3 Panel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Networks */}
        <ResizablePanel 
          defaultSize={20} 
          minSize={15} 
          maxSize={30}
          className="min-w-[200px]"
        >
          <NetworkPanel
            networks={networks}
            onMethodSelect={handleMethodSelect}
            onNetworkRemove={removeNetwork}
            onNetworkRefresh={refreshNetwork}
          />
        </ResizablePanel>
        
        <ResizableHandle className="w-[1px] bg-border hover:bg-primary/50 transition-colors" />
        
        {/* Center Panel - Method Tabs */}
        <ResizablePanel 
          defaultSize={40} 
          minSize={30} 
          maxSize={50}
        >
          <MethodTabsPanel
            tabs={methodTabs}
            activeTabId={activeMethodTabId}
            onTabSelect={setActiveMethodTabId}
            onTabClose={closeMethodTab}
            methodDescriptors={methodDescriptors}
          />
        </ResizablePanel>
        
        <ResizableHandle className="w-[1px] bg-border hover:bg-primary/50 transition-colors" />
        
        {/* Right Panel - Method Interaction */}
        <ResizablePanel 
          defaultSize={40} 
          minSize={30} 
          maxSize={50}
        >
          <MethodInteractionPanel
            activeMethod={activeMethod}
            onExecute={executeMethod}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      
      {/* Add Network Dialog */}
      {showAddNetwork && (
        <AddNetworkDialog
          onAdd={(endpoint, tls) => {
            addNetwork(endpoint, tls);
            setShowAddNetwork(false);
          }}
          onClose={() => setShowAddNetwork(false)}
        />
      )}
      
      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <KeyboardShortcutsDialog
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
        />
      )}
      
      {/* Execution History Dialog */}
      {showHistory && (
        <ExecutionHistoryDialog
          open={showHistory}
          onClose={() => setShowHistory(false)}
          history={history}
          onClear={clearHistory}
          onExport={exportHistory}
          onReplay={(record) => {
            // Find the network and method, then set params
            const network = networks.find(n => n.name === record.network);
            if (network) {
              const service = network.services.find(s => s.service === record.service);
              if (service) {
                const method = service.methods?.find((m: any) => m.name === record.method);
                if (method) {
                  handleMethodSelect(network, service, method);
                  // TODO: Set the params in the interaction panel
                }
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default GrpcExplorerApp;