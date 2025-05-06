// utils/userSettingsService.ts

// Constants
const SETTINGS_KEY = 'grpc_explorer_user_settings';

// Default settings
export interface UserSettings {
  cache: {
    enabled: boolean;
    expirationDays: number;
  };
  ui: {
    expandServicesByDefault: boolean;
    expandMethodsByDefault: boolean;
  };
  endpoints: {
    history: string[];
    current: string | null;
    useTLS: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  cache: {
    enabled: true,
    expirationDays: 7
  },
  ui: {
    expandServicesByDefault: false,
    expandMethodsByDefault: false
  },
  endpoints: {
    history: [],
    current: null,
    useTLS: false
  }
};

// Load settings
export const getUserSettings = (): UserSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with default settings to ensure all properties exist
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        cache: {
          ...DEFAULT_SETTINGS.cache,
          ...(parsed.cache || {})
        },
        ui: {
          ...DEFAULT_SETTINGS.ui,
          ...(parsed.ui || {})
        },
        endpoints: {
          ...DEFAULT_SETTINGS.endpoints,
          ...(parsed.endpoints || {})
        }
      };
    }
  } catch (err) {
    console.error('Failed to load user settings:', err);
  }
  
  // If no settings found or error parsing, return default
  saveUserSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
};

// Save settings
export const saveUserSettings = (settings: UserSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save user settings:', err);
  }
};

// Update single setting
export const updateSetting = <K extends keyof UserSettings>(
  category: K, 
  key: keyof UserSettings[K], 
  value: any
): UserSettings => {
  const settings = getUserSettings();
  settings[category][key] = value;
  saveUserSettings(settings);
  return settings;
};

// Add endpoint to history
export const addEndpointToHistory = (endpoint: string): UserSettings => {
  const settings = getUserSettings();
  const history = settings.endpoints.history.filter(e => e !== endpoint);
  history.unshift(endpoint); // Add to beginning
  
  // Limit history to 10 items
  if (history.length > 10) {
    history.pop();
  }
  
  settings.endpoints.history = history;
  settings.endpoints.current = endpoint;
  saveUserSettings(settings);
  return settings;
};

// Set TLS setting
export const setUseTLS = (useTLS: boolean): UserSettings => {
  const settings = getUserSettings();
  settings.endpoints.useTLS = useTLS;
  saveUserSettings(settings);
  return settings;
};

// Clear cache
export const clearMethodCache = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const methodCacheKeys = keys.filter(key => 
      key.startsWith('grpc_explorer_method_') || 
      key.startsWith('grpc_explorer_service_') || 
      key.startsWith('grpc_explorer_services_')
    );
    
    methodCacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Cleared ${methodCacheKeys.length} cached items`);
  } catch (err) {
    console.error('Failed to clear cache:', err);
  }
};

// Get cache statistics
export const getCacheStats = (): { count: number, sizeKB: number } => {
  try {
    const keys = Object.keys(localStorage);
    const methodCacheKeys = keys.filter(key => 
      key.startsWith('grpc_explorer_method_') || 
      key.startsWith('grpc_explorer_service_') || 
      key.startsWith('grpc_explorer_services_')
    );
    
    const count = methodCacheKeys.length;
    let totalSize = 0;
    
    methodCacheKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length * 2; // Approximate size in bytes (UTF-16 chars)
      }
    });
    
    return {
      count,
      sizeKB: Math.round(totalSize / 1024)
    };
  } catch (err) {
    console.error('Failed to calculate cache stats:', err);
    return { count: 0, sizeKB: 0 };
  }
};