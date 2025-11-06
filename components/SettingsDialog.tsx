'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getCacheTTL,
  setCacheTTL,
  CACHE_TTL_OPTIONS,
  CACHE_TTL_LABELS,
  type CacheTTLOption,
  clearAllCache,
  getCacheStats,
} from '@/lib/utils/client-cache';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [defaultTimeout, setDefaultTimeout] = useState(10000);
  const [cacheTTL, setCacheTTLState] = useState<CacheTTLOption>('ONE_HOUR');
  const [cacheStats, setCacheStatsState] = useState({ count: 0, sizeKB: 0 });

  // Load current cache TTL setting
  useEffect(() => {
    if (open) {
      const currentTTL = getCacheTTL();
      const option = Object.entries(CACHE_TTL_OPTIONS).find(
        ([_, value]) => value === currentTTL
      )?.[0] as CacheTTLOption || 'ONE_HOUR';
      setCacheTTLState(option);

      // Load cache stats
      setCacheStatsState(getCacheStats());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <DialogTitle>Settings</DialogTitle>
          </div>
          <DialogDescription>
            Configure your gRPC Explorer preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Appearance</h3>
            <div className="space-y-2">
              <label className="text-sm">Theme</label>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      "px-4 py-2 rounded text-sm capitalize transition-colors",
                      theme === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">gRPC Options</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm block mb-1">Default Request Timeout (ms)</label>
                <input
                  type="number"
                  value={defaultTimeout}
                  onChange={(e) => setDefaultTimeout(parseInt(e.target.value) || 10000)}
                  className={cn(
                    "w-full px-3 py-2 rounded text-sm",
                    "bg-background border border-border",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                  min={1000}
                  max={60000}
                  step={1000}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Cache</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm block mb-2">Cache Duration</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CACHE_TTL_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCacheTTLState(key as CacheTTLOption)}
                      className={cn(
                        "px-3 py-2 rounded text-sm transition-colors text-left",
                        cacheTTL === key
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/80"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Controls how long service discovery results are cached
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm">Cache Statistics</label>
                  <button
                    onClick={() => {
                      clearAllCache();
                      setCacheStatsState(getCacheStats());
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear Cache
                  </button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Cached entries: {cacheStats.count}</div>
                  <div>Storage used: {cacheStats.sizeKB} KB</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded text-sm transition-colors",
              "bg-secondary hover:bg-secondary/80"
            )}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Save cache TTL setting
              setCacheTTL(cacheTTL);
              onClose();
            }}
            className={cn(
              "px-4 py-2 rounded text-sm transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
