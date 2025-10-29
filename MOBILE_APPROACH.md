# Mobile Approach: Progressive Web App (PWA)

## Concept
Make the app installable on mobile devices with offline capability and native app experience.

## Implementation Strategy

### Core PWA Features
1. **Web App Manifest** - Makes app installable
2. **Service Worker** - Enables offline functionality and caching
3. **HTTPS** - Required for PWA (already have via deployment)

### Benefits
- Install as app icon on home screen
- Full-screen experience (no browser UI)
- Offline access to cached networks
- Better performance via caching
- Push notifications (optional future enhancement)

### Implementation Steps

#### 1. Create manifest.json
```json
{
  "name": "gRPC Web Explorer",
  "short_name": "gRPC Explorer",
  "description": "Explore and interact with gRPC services",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 2. Service Worker (sw.js)
```javascript
// Cache network service definitions
// Cache static assets
// Serve from cache when offline
```

#### 3. Register Service Worker
```typescript
// app/register-sw.ts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### Files to Create/Modify
- `public/manifest.json` - App manifest
- `public/sw.js` - Service worker
- `public/icon-192.png` - App icon small
- `public/icon-512.png` - App icon large
- `app/layout.tsx` - Link to manifest
- `components/InstallPrompt.tsx` - Install button component

### Caching Strategy
- **Cache First**: Static assets, icons
- **Network First, Cache Fallback**: API calls
- **Cache network service definitions**: Store in IndexedDB

### Testing
- Chrome DevTools > Application > Manifest
- Chrome DevTools > Application > Service Workers
- Test offline mode by disabling network

### Deployment Considerations
- Requires HTTPS (already have)
- Update service worker version on deploys
- Clear old caches periodically

