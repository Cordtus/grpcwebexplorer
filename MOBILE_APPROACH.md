# Mobile Approach: Tab-Based Navigation

## Concept
Simplify mobile UX with tab navigation - only one view visible at a time.

## Implementation Strategy

### Tab Structure
1. **Networks** - Browse and select methods
2. **Method** - Configure and execute selected method
3. **Results** - View execution results

### Benefits
- Simpler to implement than stacked layout
- Less cognitive load (one task at a time)
- Works well on small screens
- Native mobile app feel

### Drawbacks
- Can't see multiple panels simultaneously
- More taps to switch context
- Loses desktop power-user efficiency

### Implementation
```tsx
const [activeTab, setActiveTab] = useState<'networks' | 'method' | 'results'>('networks');

// Mobile: Show tabs
<div className="lg:hidden">
  <TabBar active={activeTab} onChange={setActiveTab} />
  {activeTab === 'networks' && <NetworksPanel />}
  {activeTab === 'method' && <MethodPanel />}
  {activeTab === 'results' && <ResultsPanel />}
</div>

// Desktop: Show all panels
<div className="hidden lg:flex">
  <NetworksPanel />
  <MethodPanel />
  <ResultsPanel />
</div>
```

### Key Features
- Badge counts on tabs (e.g., "Methods (3)")
- Auto-switch to Method tab when selecting from Networks
- Auto-switch to Results tab after execution
- Swipe gestures between tabs (optional enhancement)

### Files to Modify
- `components/GrpcExplorerApp.tsx` - Add tab state and conditional rendering
- `components/MobileTabBar.tsx` - New component for tab navigation
- `app/layout.tsx` - Viewport meta tag (already done)

