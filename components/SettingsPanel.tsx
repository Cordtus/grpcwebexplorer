// components/SettingsPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  getUserSettings,
  saveUserSettings,
  updateSetting,
  clearMethodCache,
  getCacheStats,
  UserSettings
} from '@/utils/userSettings';
import LoadingSpinner from './LoadingSpinner';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onSettingsChanged
}) => {
  const [settings, setSettings] = useState<UserSettings>(getUserSettings());
  const [cacheStats, setCacheStats] = useState({ count: 0, sizeKB: 0 });
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'display'>('general');

  useEffect(() => {
    if (isOpen) {
      setSettings(getUserSettings());
      setCacheStats(getCacheStats());
    }
  }, [isOpen]);

  const handleSettingChange = <K extends keyof UserSettings>(
    category: K,
    key: keyof UserSettings[K],
    value: any
  ) => {
    const updatedSettings = updateSetting(category, key, value);
    setSettings(updatedSettings);
    onSettingsChanged();
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
    <div className="bg-dark-surface rounded-lg shadow-lg w-full max-w-md overflow-hidden">
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

    <div className="flex border-b border-dark-border">
    <button
    className={`px-4 py-2 flex-1 text-sm font-medium ${
      activeTab === 'general'
      ? 'text-blue-accent border-b-2 border-blue-accent'
      : 'text-text-secondary hover:text-text-primary'
    }`}
    onClick={() => setActiveTab('general')}
    >
    General
    </button>
    <button
    className={`px-4 py-2 flex-1 text-sm font-medium ${
      activeTab === 'display'
      ? 'text-blue-accent border-b-2 border-blue-accent'
      : 'text-text-secondary hover:text-text-primary'
    }`}
    onClick={() => setActiveTab('display')}
    >
    Display
    </button>
    </div>

    <div className="p-5">
    {activeTab === 'general' && (
      <div>
      <h3 className="text-lg font-medium text-text-primary mb-4">Cache Settings</h3>

      <div className="flex items-center justify-between mb-4">
      <label className="text-text-primary">Enable Local Method Cache</label>
      <div
      onClick={() => handleSettingChange('cache', 'enabled', !settings.cache.enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer ${
        settings.cache.enabled ? 'bg-blue-accent' : 'bg-dark-border'
      }`}
      >
      <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        settings.cache.enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
      />
      </div>
      </div>

      <div className="flex items-center justify-between mb-4">
      <label className="text-text-primary">Cache Expiration</label>
      <select
      value={settings.cache.expirationDays}
      onChange={(e) => handleSettingChange('cache', 'expirationDays', parseInt(e.target.value, 10))}
      className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-text-primary"
      disabled={!settings.cache.enabled}
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
      {isClearingCache ? (
        <span className="flex items-center justify-center">
        <LoadingSpinner size="sm" color="#ffffff" />
        <span className="ml-2">Clearing...</span>
        </span>
      ) : (
        'Clear Cache'
      )}
      </button>
      </div>
    )}

    {activeTab === 'display' && (
      <div>
      <h3 className="text-lg font-medium text-text-primary mb-4">Display Settings</h3>

      <div className="flex items-center justify-between mb-4">
      <label className="text-text-primary">Expand Service List by Default</label>
      <div
      onClick={() => handleSettingChange('ui', 'expandServicesByDefault', !settings.ui.expandServicesByDefault)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer ${
        settings.ui.expandServicesByDefault ? 'bg-blue-accent' : 'bg-dark-border'
      }`}
      >
      <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        settings.ui.expandServicesByDefault ? 'translate-x-6' : 'translate-x-1'
      }`}
      />
      </div>
      </div>

      <div className="flex items-center justify-between mb-4">
      <label className="text-text-primary">Expand Method Cards by Default</label>
      <div
      onClick={() => handleSettingChange('ui', 'expandMethodsByDefault', !settings.ui.expandMethodsByDefault)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer ${
        settings.ui.expandMethodsByDefault ? 'bg-blue-accent' : 'bg-dark-border'
      }`}
      >
      <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        settings.ui.expandMethodsByDefault ? 'translate-x-6' : 'translate-x-1'
      }`}
      />
      </div>
      </div>

      <div className="mt-6 pt-4 border-t border-dark-border">
      <h4 className="text-sm font-medium text-text-primary mb-2">Theme</h4>
      <div className="mb-4">
      <p className="text-text-secondary text-xs mb-3">
      The application follows your system's dark mode preferences
      </p>
      </div>
      </div>
      </div>
    )}

    <div className="pt-4 mt-4 border-t border-dark-border">
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
