'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HelpCircle, Network, Play, Keyboard, Database, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHORTCUTS } from '@/lib/hooks/useKeyboardShortcuts';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

type Section = 'overview' | 'networks' | 'methods' | 'shortcuts' | 'cache' | 'troubleshooting';

const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose }) => {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const formatShortcut = (shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }) => {
    const parts = [];
    if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
    if (shortcut.shift) parts.push('⇧');
    if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
    parts.push(shortcut.key === 'Tab' ? '⇥' : shortcut.key === 'Enter' ? '↵' : shortcut.key.toUpperCase());
    return parts.join(' ');
  };

  const sections = [
    { id: 'overview', label: 'Quick Start', icon: HelpCircle },
    { id: 'networks', label: 'Adding Networks', icon: Network },
    { id: 'methods', label: 'Executing Methods', icon: Play },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'cache', label: 'Cache Management', icon: Database },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Welcome to gRPC Explorer</h3>
              <p className="text-sm text-muted-foreground">
                A web-based interface for exploring and interacting with gRPC services via reflection.
                Connect to multiple endpoints, discover services, and execute methods with auto-generated forms.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 p-3 bg-secondary/20 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-medium">Add a Network</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Add Network" and enter a gRPC endpoint or select from the Cosmos Chain Registry
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-secondary/20 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-medium">Browse Services</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expand services in the left panel to view available methods
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-secondary/20 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-medium">Execute Methods</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click a method to open it, fill in the auto-generated form, and execute
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'networks':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Adding Networks</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Three ways to connect to gRPC endpoints:
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="text-primary">Method 1:</span> Direct Endpoint
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Click "Add Network" button</li>
                  <li>Enter gRPC endpoint (e.g., <code className="bg-secondary px-1 rounded">grpc.cosmos.directory:443</code>)</li>
                  <li>Enable TLS toggle for port 443 endpoints</li>
                  <li>Click "Add Network"</li>
                </ol>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="text-primary">Method 2:</span> Chain Registry Browser
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Click "Add Network" button</li>
                  <li>Click "Browse Chain Registry"</li>
                  <li>Search for a chain (e.g., "Cosmos Hub", "Osmosis")</li>
                  <li>Select chain to view available gRPC endpoints</li>
                  <li>Click "Use All Endpoints (Round-Robin)" or select specific endpoint</li>
                </ol>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="text-primary">Method 3:</span> Chain Name Shortcut
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Click "Add Network" button</li>
                  <li>Type just the chain name (e.g., "dydx", "osmosis")</li>
                  <li>System auto-detects and uses round-robin across all chain endpoints</li>
                </ol>
              </div>
            </div>
          </div>
        );

      case 'methods':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Executing Methods</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Execute gRPC methods with auto-generated, type-safe parameter forms.
              </p>
            </div>

            <div className="space-y-3">
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-3">Steps:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Select a network tab from the left panel</li>
                  <li>Expand a service to view its methods</li>
                  <li>Click a method to open it in the center panel</li>
                  <li>Fill in the generated parameter form with typed inputs</li>
                  <li>Click "Execute Method" or press {formatShortcut(SHORTCUTS.EXECUTE)}</li>
                  <li>View response in the right panel</li>
                </ol>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-3">Form Features:</h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Type-specific inputs:</strong> Strings, numbers, booleans, enums, nested messages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Field validation:</strong> Required/optional field indicators</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Array management:</strong> Add/remove array items dynamically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Enum dropdowns:</strong> Select from available enum values</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Keyboard navigation for efficient workflow.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { category: 'Navigation', shortcuts: [SHORTCUTS.NEXT_TAB, SHORTCUTS.PREV_TAB] },
                { category: 'Actions', shortcuts: [SHORTCUTS.ADD_NETWORK, SHORTCUTS.CLOSE_TAB, SHORTCUTS.EXECUTE] },
                { category: 'Data', shortcuts: [SHORTCUTS.EXPORT, SHORTCUTS.IMPORT] },
                { category: 'Help', shortcuts: [SHORTCUTS.SHOW_SHORTCUTS] },
              ].map(({ category, shortcuts }) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 rounded bg-secondary/20"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <kbd className="px-2 py-1 text-xs font-mono rounded bg-background border border-border">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-secondary/20 rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                Press <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-background border border-border">Esc</kbd> to close dialogs
              </p>
            </div>
          </div>
        );

      case 'cache':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Cache Management</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Service discovery results are cached in your browser for faster repeat access.
              </p>
            </div>

            <div className="space-y-3">
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">How Caching Works</h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Service discovery results cached in browser localStorage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>1-hour Time-To-Live (TTL) for each endpoint</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Cached data specific to your browser (no server-side cache)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Subsequent requests use cache until TTL expires</span>
                  </li>
                </ul>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Managing Cache</h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Click cache indicator in menu bar to view statistics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>See total cached entries and storage size in KB</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Click "Clear all cache" to force refresh from servers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Refresh network to bypass cache for single endpoint</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'troubleshooting':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Troubleshooting</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Common issues and solutions.
              </p>
            </div>

            <div className="space-y-3">
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 text-amber-600 dark:text-amber-500">
                  Reflection Failures
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Ensure gRPC reflection is enabled on target server</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Verify TLS settings match endpoint (port 443 = TLS required)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Check network connectivity and firewall rules</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Test with grpcurl: <code className="bg-secondary px-1 rounded text-xs">grpcurl -plaintext endpoint:port list</code></span>
                  </li>
                </ul>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 text-amber-600 dark:text-amber-500">
                  Cache Issues
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Clear cache via menu bar if seeing stale data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Cache stored in browser localStorage (check browser storage limits)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Private browsing mode doesn't persist cache</span>
                  </li>
                </ul>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 text-amber-600 dark:text-amber-500">
                  Chain Registry Rate Limits
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>GitHub API limits to 60 requests/hour without authentication</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Chain list cached for 1 hour to minimize API calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Use direct endpoint method if registry unavailable</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] p-0">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-56 bg-secondary/30 border-r border-border p-4 space-y-1">
            <div className="px-3 py-2 mb-2">
              <h2 className="text-sm font-semibold">Help & Guide</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Learn how to use gRPC Explorer
              </p>
            </div>

            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as Section)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;
