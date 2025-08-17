import { useState, useEffect } from 'react';

export interface ExecutionRecord {
  id: string;
  timestamp: Date;
  network: string;
  service: string;
  method: string;
  params: any;
  response?: any;
  error?: string;
  duration?: number;
}

const STORAGE_KEY = 'grpc-explorer-history';
const MAX_HISTORY_SIZE = 100;

export function useExecutionHistory() {
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  
  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const records = parsed.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        }));
        setHistory(records);
      }
    } catch (err) {
      console.error('Failed to load execution history:', err);
    }
  }, []);
  
  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save execution history:', err);
    }
  }, [history]);
  
  const addExecution = (record: Omit<ExecutionRecord, 'id' | 'timestamp'>) => {
    const newRecord: ExecutionRecord = {
      ...record,
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    
    setHistory(prev => {
      const updated = [newRecord, ...prev];
      // Keep only the most recent records
      return updated.slice(0, MAX_HISTORY_SIZE);
    });
    
    return newRecord;
  };
  
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };
  
  const getRecentExecutions = (limit: number = 10) => {
    return history.slice(0, limit);
  };
  
  const getMethodHistory = (method: string, service?: string) => {
    return history.filter(r => 
      r.method === method && 
      (!service || r.service === service)
    );
  };
  
  const exportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `grpc-history-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const importHistory = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const imported = JSON.parse(content);
          const records = imported.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp)
          }));
          setHistory(prev => [...records, ...prev].slice(0, MAX_HISTORY_SIZE));
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };
  
  return {
    history,
    addExecution,
    clearHistory,
    getRecentExecutions,
    getMethodHistory,
    exportHistory,
    importHistory
  };
}