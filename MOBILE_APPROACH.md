# Mobile Approach: Hybrid (Drawer + Stack)

## Concept
Combine drawer navigation for networks with vertical stacking for method/results panels.

## Implementation Strategy

### Layout Structure
1. **Networks Panel**: Bottom drawer/sheet (swipe up from bottom)
2. **Method Descriptor**: Fixed header card at top
3. **Method Instances**: Middle section
4. **Results**: Bottom section (expandable)

### User Flow
1. Tap floating button to open networks drawer
2. Select method → drawer closes, method appears in instances
3. Configure parameters in method section
4. Execute → results expand at bottom
5. Tap networks button again to select another method

### Benefits
- Maximizes vertical screen space
- Networks accessible but out of the way
- Natural mobile interaction patterns (drawers, sheets)
- Single-column focus reduces cognitive load

### Key UI Components

#### Bottom Drawer
```tsx
<Sheet open={showNetworks} onOpenChange={setShowNetworks}>
  <SheetContent side="bottom" className="h-[80vh]">
    <NetworksPanel />
  </SheetContent>
</Sheet>
```

#### Floating Action Button
```tsx
<button 
  className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-blue-600 shadow-lg"
  onClick={() => setShowNetworks(true)}
>
  <Network />
</button>
```

#### Stacked Content
```tsx
<div className="flex-1 flex flex-col overflow-hidden">
  <MethodDescriptor /> {/* Sticky header */}
  <div className="flex-1 overflow-y-auto">
    <MethodInstances />
  </div>
  <Results /> {/* Collapsible from bottom */}
</div>
```

### Interactions
- **Swipe up**: Open networks drawer
- **Swipe down**: Close drawer or collapse results
- **Tap outside**: Close drawer
- **Pull to refresh**: Refresh network services

### Libraries Needed
- `@radix-ui/react-dialog` (already have) - For drawer/sheet
- Or implement custom drawer with gestures

### Files to Modify
- `components/GrpcExplorerApp.tsx` - Restructure layout
- `components/NetworkDrawer.tsx` - New bottom sheet component
- `components/FloatingNetworkButton.tsx` - FAB component
- `app/layout.tsx` - Viewport meta tag (already done)

### Mobile-Specific Enhancements
- Haptic feedback on drawer open/close
- Smooth spring animations for drawer
- Gesture recognizers for swipe actions
- Touch-friendly 48px minimum tap targets
- Keyboard-aware layout (shifts up when keyboard opens)

