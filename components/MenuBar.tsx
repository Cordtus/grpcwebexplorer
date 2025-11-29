// Compact menu bar component
'use client';

import React, { useState } from 'react';
import { Settings, Download, Upload, Trash2, Database, HelpCircle } from 'lucide-react';
import { getCacheStats, clearAllCache } from '@/lib/utils/client-cache';

interface MenuBarProps {
  onShowSettings?: () => void;
  onShowKeyboardShortcuts?: () => void;
  onShowHelp?: () => void;
}

export default function MenuBar({ onShowSettings, onShowKeyboardShortcuts, onShowHelp }: MenuBarProps) {
  const [cacheStats, setCacheStats] = useState({ count: 0, sizeKB: 0 });
  const [showCacheMenu, setShowCacheMenu] = useState(false);
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Update cache stats
  const updateCacheStats = () => {
    const stats = getCacheStats();
    setCacheStats(stats);
  };

  // Handle clear cache
  const handleClearCache = () => {
    if (confirm('Clear all cached data? This will remove all networks and you will need to re-add them.')) {
      clearAllCache();
      // Also clear network cache
      localStorage.removeItem('grpc-explorer-networks');
      updateCacheStats();
      setShowCacheMenu(false);
      // Reload page to clear networks from state
      window.location.reload();
    }
  };

  // Load cache stats on mount
  React.useEffect(() => {
    updateCacheStats();
  }, []);

  return (
    <div className="h-10 bg-secondary/30 border-b border-border flex-between px-4 shrink-0 relative z-50">
      {/* Left side - App title */}
      <div className="flex-center-2">
        <h1 className="section-header">gRPC Explorer</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex-center-1">
        {/* Cache Stats */}
        <div className="relative">
          <button
            onClick={() => {
              updateCacheStats();
              setShowCacheMenu(!showCacheMenu);
            }}
            className="flex-center gap-1.5 px-2 py-1 text-muted-sm hover:bg-secondary/50 rounded transition-colors"
            title="Cache information"
          >
            <Database className="h-3.5 w-3.5" />
            <span>{cacheStats.count} cached</span>
            <span className="text-muted-foreground/70">
              ({cacheStats.sizeKB}KB)
            </span>
          </button>

          {/* Cache dropdown menu */}
          {showCacheMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCacheMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                <div className="px-3 py-2 text-muted-sm border-b border-border">
                  <div className="flex-between mb-1">
                    <span>Cache entries:</span>
                    <span className="font-medium">{cacheStats.count}</span>
                  </div>
                  <div className="flex-between">
                    <span>Size:</span>
                    <span className="font-medium">{cacheStats.sizeKB} KB</span>
                  </div>
                </div>
                <button
                  onClick={handleClearCache}
                  className="w-full flex-center-2 px-3 py-2 text-xs text-destructive hover:bg-secondary/50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all cache
                </button>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border mx-1" />

        {/* Help */}
        <button
          onClick={onShowHelp || onShowKeyboardShortcuts}
          className="icon-btn text-muted-foreground"
          title={`Help & Guide (${isMac ? 'Cmd' : 'Ctrl'}+Shift+?)`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Settings */}
        <button onClick={onShowSettings} className="icon-btn text-muted-foreground" title="Settings">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
