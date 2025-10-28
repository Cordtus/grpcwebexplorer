'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS } from '@/lib/hooks/useKeyboardShortcuts';
import { Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({ open, onClose }) => {
  const shortcutCategories = {
    'Navigation': [
      SHORTCUTS.NEXT_TAB,
      SHORTCUTS.PREV_TAB,
    ],
    'Actions': [
      SHORTCUTS.ADD_NETWORK,
      SHORTCUTS.CLOSE_TAB,
      SHORTCUTS.EXECUTE,
    ],
    'Data Management': [
      SHORTCUTS.EXPORT,
      SHORTCUTS.IMPORT,
    ],
    'Help': [
      SHORTCUTS.SHOW_SHORTCUTS,
    ],
  };

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const formatShortcut = (shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }) => {
    const parts = [];
    if (shortcut.ctrl) parts.push(isMac ? 'Cmd' : 'Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push(isMac ? 'Option' : 'Alt');
    parts.push(shortcut.key === 'Tab' ? 'Tab' : shortcut.key === 'Enter' ? 'Enter' : shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Quick actions for efficient gRPC exploration
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {Object.entries(shortcutCategories).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{category}</h3>
              <div className="space-y-1">
                {shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded",
                      "bg-secondary/20 hover:bg-secondary/30 transition-colors"
                    )}
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className={cn(
                      "px-2 py-1 text-xs font-mono rounded",
                      "bg-background border border-border"
                    )}>
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-secondary/50">Esc</kbd> to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;