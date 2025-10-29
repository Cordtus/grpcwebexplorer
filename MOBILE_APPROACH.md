# Mobile Approach: Stacked Layout

## Concept
Responsive layout that stacks panels vertically on mobile while maintaining horizontal layout on desktop.

## Implementation Strategy

### Breakpoints
- Mobile: < 1024px (vertical stack)
- Desktop: >= 1024px (horizontal panels)

### Layout Changes
1. **Main Container**: `flex flex-col lg:flex-row`
2. **Networks Panel**: 
   - Mobile: `w-full max-h-[35vh]` (collapsible, top of screen)
   - Desktop: `lg:w-[30%]` (left sidebar)
3. **Method Descriptor**: Full width on both
4. **Method Instances + Results**:
   - Mobile: Stack vertically, equal height
   - Desktop: Horizontal resizable panels

### Key Changes Needed
- Replace `ResizablePanelGroup` with conditional rendering
- Add touch-friendly spacing (p-4 → p-6 on mobile)
- Increase tap targets to minimum 44px
- Make descriptor panel collapsible on mobile

### Files to Modify
- `components/GrpcExplorerApp.tsx` - Main layout
- `app/layout.tsx` - Add viewport meta tag
- Tailwind classes throughout for responsive sizing

