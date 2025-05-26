# RevenueCat User Linking Enhancement Implementation Plan

## Executive Summary

Based on analysis of the codebase and RevenueCat documentation, our current user linking architecture is sound but has execution gaps. This plan enhances the existing system to ensure reliable user linking across all authentication scenarios while maintaining the proven native initialization strategy.

## Current State Analysis

### What Works ✅
- **Native initialization** in `MainApplication.kt` (essential per RevenueCat docs)
- **Anonymous user creation** on app launch (correct pattern)
- **User linking function** `linkRevenueCatToPatient()` (sound logic)
- **Cache invalidation** after `logIn()` calls (proper approach)
- **Patient ID as user ID** (UUID-based, RevenueCat compliant)

### Current Gaps ❌
- **Single trigger point**: User linking only runs once during app startup
- **No authentication state monitoring**: Missing Medplum profile change detection
- **No app state management**: No retry on app foreground/background
- **Manual retry missing**: No user-initiated linking attempts
- **Timing dependencies**: 10-second delay may miss authentication events

## Implementation Strategy

### Phase 1: Authentication State Monitoring

**Objective**: Trigger user linking when Medplum authentication state changes

**Files to Modify**:
- `contexts/SubscriptionContext.tsx`

**Implementation**:
1. Add `lastPatientId` state to track authentication changes
2. Add `useEffect` dependency on `medplum.getProfile()?.id`
3. Trigger user linking when Patient ID changes (sign in/out/switch)
4. Add debouncing to prevent rapid successive calls

**Code Changes**:
```typescript
// Add state tracking
const [lastPatientId, setLastPatientId] = useState<string | null>(null);

// Add authentication state monitoring
useEffect(() => {
  const currentPatientId = medplum.getProfile()?.id || null;
  
  if (currentPatientId !== lastPatientId) {
    setLastPatientId(currentPatientId);
    
    // Trigger user linking if authenticated and RevenueCat ready
    if (currentPatientId && !isLoading) {
      handleUserLinking('authentication_change');
    }
  }
}, [medplum.getProfile()?.id, lastPatientId, isLoading]);
```

### Phase 2: App State Change Monitoring

**Objective**: Retry user linking when app comes to foreground

**Files to Modify**:
- `contexts/SubscriptionContext.tsx`

**Implementation**:
1. Import React Native's `AppState`
2. Add listener for app state changes
3. Trigger user linking on `active` state if authenticated
4. Add throttling to prevent excessive calls

**Code Changes**:
```typescript
import { AppState, Platform } from "react-native";

// Add app state monitoring
useEffect(() => {
  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      const currentPatientId = medplum.getProfile()?.id;
      if (currentPatientId && !isLoading) {
        // Throttled retry on app foreground
        handleUserLinking('app_foreground');
      }
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, [medplum.getProfile()?.id, isLoading]);
```

### Phase 3: Manual Retry Capability

**Objective**: Allow users to manually trigger user linking

**Files to Modify**:
- `contexts/SubscriptionContext.tsx` (add to context interface)
- `components/SettingsModal.tsx` (add retry button)
- `components/RevenueCatStatusPanel.tsx` (enhance debug panel)

**Implementation**:
1. Add `retryUserLinking()` function to SubscriptionContext
2. Expose function through context interface
3. Add "Retry Linking" button in settings/debug panels
4. Include loading states and user feedback

**Code Changes**:
```typescript
// In SubscriptionContextType
type SubscriptionContextType = {
  // ... existing properties
  retryUserLinking: () => Promise<boolean>;
  isLinkingInProgress: boolean;
};

// Implementation
const retryUserLinking = async (): Promise<boolean> => {
  if (isLinkingInProgress) return false;
  
  setIsLinkingInProgress(true);
  try {
    return await handleUserLinking('manual_retry');
  } finally {
    setIsLinkingInProgress(false);
  }
};
```

### Phase 4: Enhanced User Linking Logic

**Objective**: Create a centralized, robust user linking handler

**Files to Modify**:
- `contexts/SubscriptionContext.tsx`

**Implementation**:
1. Create `handleUserLinking()` function that wraps `linkRevenueCatToPatient()`
2. Add trigger source tracking for debugging
3. Add pre-flight checks (RevenueCat ready, authenticated, etc.)
4. Add comprehensive error handling and logging
5. Add retry logic with exponential backoff

**Code Changes**:
```typescript
const handleUserLinking = async (
  triggerSource: 'startup' | 'authentication_change' | 'app_foreground' | 'manual_retry'
): Promise<boolean> => {
  try {
    await logToCommunication(`User Linking Triggered: ${triggerSource}`, {
      triggerSource,
      timestamp: new Date().toISOString(),
      platform: Platform.OS
    });

    // Pre-flight checks
    if (Platform.OS === 'web') return false;
    if (!medplum.getProfile()?.id) return false;
    if (typeof Purchases?.logIn !== 'function') return false;

    // Call enhanced linking function
    return await linkRevenueCatToPatient();
    
  } catch (error) {
    await logToCommunication(`User Linking Failed: ${triggerSource}`, {
      triggerSource,
      error: error instanceof Error ? error.message : String(error),
      platform: Platform.OS
    });
    return false;
  }
};
```

### Phase 5: Timing and Reliability Improvements

**Objective**: Ensure user linking works reliably across different timing scenarios

**Files to Modify**:
- `contexts/SubscriptionContext.tsx`
- `utils/subscription/initialize-revenue-cat.ts`

**Implementation**:
1. Add RevenueCat readiness checks before linking attempts
2. Add retry mechanism with exponential backoff
3. Improve startup timing coordination
4. Add circuit breaker pattern for repeated failures

**Code Changes**:
```typescript
const waitForRevenueCatReady = async (maxWaitMs = 5000): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      if (typeof Purchases?.isConfigured === 'function' && 
          Purchases.isConfigured() &&
          typeof Purchases?.getAppUserID === 'function') {
        await Purchases.getAppUserID(); // Test actual call
        return true;
      }
    } catch (error) {
      // RevenueCat not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
};
```

## File-by-File Implementation Details

### `contexts/SubscriptionContext.tsx`

**Changes Required**:
1. Add new state variables for tracking
2. Add multiple `useEffect` hooks for different triggers
3. Enhance existing `linkRevenueCatToPatient()` function
4. Add new `handleUserLinking()` centralized function
5. Add `retryUserLinking()` public function
6. Update context interface and provider value

**Estimated Lines Added**: ~150-200 lines

### `components/SettingsModal.tsx`

**Changes Required**:
1. Import `useSubscription` hook
2. Add "Retry User Linking" button
3. Add loading state display
4. Add success/error feedback

**Estimated Lines Added**: ~30-50 lines

### `components/RevenueCatStatusPanel.tsx`

**Changes Required**:
1. Add manual linking test button
2. Display current linking status
3. Show trigger source history
4. Enhanced diagnostic information

**Estimated Lines Added**: ~40-60 lines

## Testing Strategy

### Unit Testing
- Mock Medplum authentication state changes
- Test trigger conditions and debouncing
- Verify error handling and logging

### Integration Testing
- Test user sign-in/sign-out flows
- Test app foreground/background transitions
- Test manual retry functionality
- Verify RevenueCat user ID transitions

### User Acceptance Testing
- Fresh app install → sign in → verify linking
- Sign out → sign in different user → verify switch
- App backgrounded → foregrounded → verify retry
- Manual retry from settings → verify functionality

## Rollout Plan

### Development Phase (Week 1)
- Implement Phase 1 (Authentication State Monitoring)
- Add comprehensive logging for debugging
- Test with existing anonymous users

### Testing Phase (Week 2)
- Implement Phases 2-3 (App State + Manual Retry)
- Conduct thorough testing across scenarios
- Validate logging and error handling

### Enhancement Phase (Week 3)
- Implement Phases 4-5 (Enhanced Logic + Reliability)
- Performance optimization
- User experience refinements

### Production Deployment (Week 4)
- Gradual rollout with monitoring
- Real-world validation
- Performance and reliability metrics

## Success Metrics

### Technical Metrics
- **User linking success rate**: >95% for authenticated users
- **Trigger response time**: <2 seconds from authentication change
- **Error rate**: <1% of linking attempts
- **Recovery rate**: >90% success on manual retry

### User Experience Metrics
- **Subscription continuity**: No subscription loss during user switches
- **Cross-device sync**: Subscription status consistent across devices
- **Support ticket reduction**: <5% of current RevenueCat-related issues

## Risk Mitigation

### Performance Impact
- **Risk**: Multiple triggers causing excessive API calls
- **Mitigation**: Debouncing, throttling, and circuit breaker patterns

### User Experience
- **Risk**: Visible delays or UI blocking during linking
- **Mitigation**: Async operations, loading states, background processing

### Data Integrity
- **Risk**: Subscription data loss during user transitions
- **Mitigation**: Comprehensive logging, rollback mechanisms, validation checks

## Monitoring and Alerting

### Key Metrics to Track
1. User linking attempt frequency by trigger source
2. Success/failure rates by scenario
3. RevenueCat API response times
4. Anonymous user retention (should decrease)
5. Cross-device subscription consistency

### Alert Conditions
- User linking failure rate >5%
- RevenueCat API errors >1%
- Manual retry requests >10% of user base
- Subscription data inconsistencies

## Conclusion

This implementation plan addresses the identified gaps in user linking while preserving the proven architecture. The phased approach allows for incremental validation and reduces deployment risk. The enhanced trigger system ensures user linking occurs reliably across all authentication scenarios, providing a seamless subscription experience for users.

The plan aligns with RevenueCat's documented best practices and maintains the essential native initialization while adding robust JavaScript-side user management capabilities.