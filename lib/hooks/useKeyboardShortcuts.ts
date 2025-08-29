import { useEffect } from 'react';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        
        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export const SHORTCUTS = {
  ADD_NETWORK: { key: 'n', ctrl: true, description: 'Add new network' },
  CLOSE_TAB: { key: 'w', ctrl: true, description: 'Close current tab' },
  EXECUTE: { key: 'Enter', ctrl: true, description: 'Execute method' },
  SEARCH: { key: '/', ctrl: true, description: 'Focus search' },
  NEXT_TAB: { key: 'Tab', ctrl: true, description: 'Next tab' },
  PREV_TAB: { key: 'Tab', ctrl: true, shift: true, description: 'Previous tab' },
  EXPORT: { key: 'e', ctrl: true, shift: true, description: 'Export parameters' },
  IMPORT: { key: 'i', ctrl: true, shift: true, description: 'Import parameters' },
};