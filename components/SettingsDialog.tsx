'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [defaultTimeout, setDefaultTimeout] = useState(10000);
  const [autoRefreshCache, setAutoRefreshCache] = useState(false);

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
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshCache}
                  onChange={(e) => setAutoRefreshCache(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm">Auto-refresh cache hourly</span>
              </label>
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
              // Save settings (TODO: implement persistence)
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
