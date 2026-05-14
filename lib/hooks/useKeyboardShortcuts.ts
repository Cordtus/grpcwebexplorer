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
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : true;
        const altMatch = shortcut.alt ? e.altKey : true;

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
  ADD_NETWORK: { key: 'n', ctrl: true, description: 'Open connection dialog' },
  CLOSE_TAB: { key: 'w', ctrl: true, description: 'Close current tab' },
  EXECUTE: { key: 'Enter', ctrl: true, description: 'Execute method' },
  SHOW_SHORTCUTS: { key: '?', ctrl: true, shift: true, description: 'Show keyboard shortcuts' },
};
