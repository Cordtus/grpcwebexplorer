// components/SettingsPanel.tsx
import React, { useState, useEffect } from 'react';
import { 
  getCacheConfig, 
  setCacheConfig, 
  clearMethodCache, 
  getCacheStats, 
  CacheConfig 
} from '@/utils/cacheService';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [cacheConfig, setCacheConfigState] = useState<CacheConfig>(getCacheConfig());
  const [cacheStats, setCacheStats] = useState({ count: 0, sizeKB: 0 });
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCacheStats(getCacheStats());
    }
  }, [isOpen]);

  const handleCacheToggle = () => {
    const newConfig = { 
      ...cacheConfig, 
      enabled: !cacheConfig.enabled 
    };
    setCacheConfigState(newConfig);
    setCacheConfig(newConfig);
  };

  const handleExpirationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const days = parseInt(e.target.value, 10);
    const newConfig = { 
      ...cacheConfig, 
      expirationDays: days 
    };
    setCacheConfigState(newConfig);
    setCacheConfig(newConfig);
  };

  const handleClearCache = () => {
    setIsClearingCache(true);
    setTimeout(() => {
      clearMethodCache();
      setCacheStats(getCacheStats());
      setIsClearingCache(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-surface rounded-lg shadow-lg w-96 overflow-hidden">
        <div className="bg-dark-highlight flex justify-between items-center px-4 py-3 border-b border-dark-border">
          <div className="flex items-center">
            <div className="flex gap-2 mr-3">
              <div className="w-3 h-3 rounded-full bg-error-red"></div>
              <div className="w-3 h-3 rounded-full bg-warning-yellow"></div>
              <div className="w-3 h-3 rounded-full bg-success-green"></div>
            </div>
            <span className="font-semibold text-text-primary">Settings</span>
          </div>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            ×
          </button>
        </div>
        
        <div className="p-5">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Cache Settings</h3>
            
            <div className="flex items-center justify-between mb-4">
              <label className="text-text-primary">Enable Local Method Cache</label>
              <div 
                onClick={handleCacheToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer ${
                  cacheConfig.enabled ? 'bg-blue-accent' : 'bg-dark-border'
                }`}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    cacheConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} 
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <label className="text-text-primary">Cache Expiration</label>
              <select 
                value={cacheConfig.expirationDays} 
                onChange={handleExpirationChange}
                className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-text-primary"
                disabled={!cacheConfig.enabled}
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
            
            <div className="bg-dark-bg rounded p-3 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-text-secondary">Cached Items</span>
                <span className="text-text-primary">{cacheStats.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Cache Size</span>
                <span className="text-text-primary">{cacheStats.sizeKB} KB</span>
              </div>
            </div>
            
            <button
              onClick={handleClearCache}
              disabled={isClearingCache || cacheStats.count === 0}
              className={`w-full py-2 rounded ${
                isClearingCache || cacheStats.count === 0
                  ? 'bg-dark-border text-text-secondary cursor-not-allowed'
                  : 'bg-error-red text-white hover:bg-opacity-90'
              }`}
            >
              {isClearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
          </div>
          
          <div className="pt-4 border-t border-dark-border">
            <button
              onClick={onClose}
              className="w-full py-2 rounded bg-blue-accent hover:bg-blue-accent-hover text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;