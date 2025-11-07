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
    <div className="h-10 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
      {/* Left side - App title */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          gRPC Explorer
        </h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1">
        {/* Cache Stats */}
        <div className="relative">
          <button
            onClick={() => {
              updateCacheStats();
              setShowCacheMenu(!showCacheMenu);
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
            title="Cache information"
          >
            <Database className="h-3.5 w-3.5" />
            <span>{cacheStats.count} cached</span>
            <span className="text-gray-400 dark:text-gray-500">
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
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between mb-1">
                    <span>Cache entries:</span>
                    <span className="font-medium">{cacheStats.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-medium">{cacheStats.sizeKB} KB</span>
                  </div>
                </div>
                <button
                  onClick={handleClearCache}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all cache
                </button>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />

        {/* Help */}
        <button
          onClick={onShowHelp || onShowKeyboardShortcuts}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
          title={`Help & Guide (${isMac ? 'Cmd' : 'Ctrl'}+Shift+?)`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Settings (placeholder for future) */}
        <button
          onClick={onShowSettings}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
