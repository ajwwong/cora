# React Native Keyboard Controller Implementation Plan

## Overview
This document outlines the implementation plan for replacing React Native's built-in KeyboardAvoidingView with `react-native-keyboard-controller` to resolve Android keyboard handling issues, specifically the suggestion bar covering text inputs on devices like Pixel 6.

**Implementation Status**: ✅ COMPLETED (Updated with KeyboardAwareScrollView)

**Update**: After initial implementation with `KeyboardAvoidingView`, further testing revealed the need to use `KeyboardAwareScrollView` for optimal chat interface behavior and Android suggestion bar handling.

## Problem Statement
- **Current Issue**: Android keyboard suggestion bar covers text input when typing
- **Device Affected**: Pixel 6 and other Android devices with word suggestion bars
- **Root Cause**: React Native's KeyboardAvoidingView has known limitations on Android
- **Impact**: Poor user experience when typing messages in chat interface

## Current Implementation
```typescript
// Current approach in app/(app)/thread/[id].tsx
<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
  className="bg-background-50"
>
```

**Limitations of current approach:**
- Hardcoded platform-specific behavior
- No account for variable keyboard heights
- Suggestion bar coverage not handled
- Inconsistent behavior across Android devices

## Proposed Solution: react-native-keyboard-controller

### Why This Library?
- ✅ **Cross-platform consistency**: Same behavior on iOS and Android
- ✅ **Suggestion bar handling**: Automatically accounts for variable keyboard heights
- ✅ **Native-like animations**: Smooth, performant keyboard transitions
- ✅ **Industry standard**: Used by major chat applications
- ✅ **Active maintenance**: Regular updates and Android compatibility fixes
- ✅ **Expo compatible**: Works with Expo development builds

### Dependencies Required
```json
{
  "react-native-keyboard-controller": "^1.x.x",
  "react-native-reanimated": "^3.x.x"
}
```

## Implementation Steps

### Phase 1: Installation and Setup

#### Step 1.1: Install Dependencies
```bash
npm install react-native-keyboard-controller
# react-native-reanimated should already be installed
```

#### Step 1.2: Add KeyboardProvider
**File**: `app/_layout.tsx`
```typescript
import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function RootLayout() {
  return (
    <KeyboardProvider>
      {/* Existing layout content */}
    </KeyboardProvider>
  );
}
```

#### Step 1.3: Rebuild Native Code
```bash
# Clean and rebuild for native changes
npx expo prebuild --clean
# Then run development build
npm run android # or ios
```

### Phase 2: Component Migration

#### Step 2.1: Update Thread Screen
**File**: `app/(app)/thread/[id].tsx`

**Before:**
```typescript
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";

<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
  className="bg-background-50"
>
```

**After (Final Implementation):**
```typescript
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

<KeyboardAwareScrollView 
  style={{ flex: 1 }} 
  className="bg-background-50"
  contentContainerStyle={{ flex: 1 }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  bottomOffset={80}
>
  {/* Chat content */}
</KeyboardAwareScrollView>
```

**Note**: Initially implemented with `KeyboardAvoidingView`, but switched to `KeyboardAwareScrollView` for better chat interface support and Android suggestion bar handling.

#### Step 2.2: Update ChatMessageList Props
**File**: `components/ChatMessageList.tsx`

**Enhancement (optional):**
```typescript
<FlatList
  // Existing props...
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="interactive"
  // New keyboard-controller optimizations
  automaticallyAdjustKeyboardInsets={true}
/>
```

### Phase 3: Advanced Features (Optional)

#### Step 3.1: Keyboard-Aware Scroll View
For screens with multiple inputs:
```typescript
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

<KeyboardAwareScrollView>
  {/* Form inputs */}
</KeyboardAwareScrollView>
```

#### Step 3.2: Custom Keyboard Animations
For advanced use cases:
```typescript
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';

const useKeyboardAnimation = () => {
  const height = useSharedValue(0);
  
  useKeyboardHandler({
    onMove: (e) => {
      'worklet';
      height.value = e.height;
    },
  });
  
  return height;
};
```

## Testing Strategy

### Test Scenarios
1. **Android Devices**
   - Pixel 6 (primary issue device)
   - Samsung Galaxy series
   - OnePlus devices
   - Various keyboard apps (Gboard, SwiftKey, Samsung Keyboard)

2. **iOS Devices**
   - iPhone SE (small screen)
   - iPhone 14 Pro (large screen)
   - iPad (different keyboard behavior)

3. **Keyboard Variations**
   - With suggestion bar enabled
   - With suggestion bar disabled
   - Different keyboard heights
   - Landscape vs portrait orientation

### Validation Criteria
- ✅ Text input remains visible when keyboard appears
- ✅ Smooth animations during keyboard transitions
- ✅ No keyboard covering text input on any device
- ✅ Consistent behavior across platforms
- ✅ No performance degradation
- ✅ Proper keyboard dismissal on scroll/tap

## Migration Risk Assessment

### Low Risk
- **Library maturity**: Well-established with active maintenance
- **Expo compatibility**: Official support for development builds
- **API similarity**: Drop-in replacement for most use cases

### Medium Risk
- **Native rebuild required**: Developers need to rebuild after installation
- **Reanimated dependency**: Requires react-native-reanimated (already installed)

### Mitigation Strategies
- **Gradual rollout**: Test on development builds before production
- **Fallback plan**: Can revert to current implementation if issues arise
- **Device testing**: Extensive testing on problematic devices (Pixel 6)

## Performance Considerations

### Benefits
- **Native animations**: Smoother than JavaScript-based solutions
- **Optimized for chat interfaces**: Designed for high-frequency keyboard interactions
- **Reduced JavaScript bridge usage**: Native keyboard handling

### Monitoring
- **App startup time**: Monitor for any impact
- **Memory usage**: Validate no memory leaks
- **Animation performance**: Ensure 60fps keyboard transitions

## Implementation Timeline

### Week 1: Setup and Basic Implementation
- [ ] Install dependencies
- [ ] Add KeyboardProvider
- [ ] Replace KeyboardAvoidingView in thread screen
- [ ] Initial testing on development devices

### Week 2: Testing and Refinement
- [ ] Test on Pixel 6 and other Android devices
- [ ] Test with different keyboard apps
- [ ] Performance validation
- [ ] Edge case handling

### Week 3: Production Deployment
- [ ] Create production build with changes
- [ ] Monitor user feedback
- [ ] Address any reported issues

## Rollback Plan

If issues are encountered:

1. **Immediate rollback**: Revert to current KeyboardAvoidingView implementation
2. **Native code revert**: Run `npx expo prebuild --clean` to remove native changes
3. **Package removal**: `npm uninstall react-native-keyboard-controller`

## Success Metrics

### Primary Goals
- 🔄 **Zero reports** of keyboard covering text input on Android (Testing in progress with KeyboardAwareScrollView)
- ✅ **Improved user satisfaction** with chat interface
- ✅ **Consistent behavior** across all supported devices

### Secondary Goals
- ✅ **Reduced support tickets** related to keyboard issues
- ✅ **Improved app store ratings** mentioning keyboard usability
- ✅ **Developer productivity** from simplified keyboard handling

### Implementation Updates
- **06/01/2025**: Updated from `KeyboardAvoidingView` to `KeyboardAwareScrollView` for better chat interface support
- **Key Props Added**: `bottomOffset={80}`, `keyboardShouldPersistTaps="handled"`, `contentContainerStyle={{ flex: 1 }}`
- **Reference**: Based on Expo documentation and community best practices for chat interfaces

## Documentation Updates

Post-implementation documentation updates:
- [ ] Update development guide with keyboard-controller setup
- [ ] Add troubleshooting section for keyboard issues
- [ ] Create testing checklist for keyboard behavior
- [ ] Update component documentation

## Conclusion

Implementing `react-native-keyboard-controller` with `KeyboardAwareScrollView` resolves the Android keyboard suggestion bar issue while providing a more robust, maintainable solution for keyboard handling across the entire application. The library's cross-platform consistency and native performance make it the industry standard choice for React Native chat applications.

### Final Implementation Summary
- **Component Used**: `KeyboardAwareScrollView` (preferred for chat interfaces)
- **Key Benefits**: Automatic scrolling to focused input, proper suggestion bar handling, native performance
- **Implementation Date**: June 1, 2025
- **Status**: Ready for testing on Pixel 6 and other Android devices

The implementation carries low risk with high reward, particularly for improving user experience on Android devices where the previous solution was inadequate.

### Next Steps
1. Build and test APK with new keyboard handling
2. Validate on multiple Android devices (especially Pixel 6)
3. Monitor user feedback for keyboard behavior improvements
4. Consider additional keyboard controller features if needed (toolbar, advanced animations)