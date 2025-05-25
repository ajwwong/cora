# RevenueCat User Identification Implementation Plan

## Overview

This document outlines the implementation plan for linking anonymous RevenueCat users to authenticated Medplum Patient IDs. This enhancement will provide persistent subscription history, cross-device sync, and better integration with our FHIR-based patient records.

## Current State Analysis

### Current Flow
1. **App Launch**: RevenueCat initializes with anonymous user ID in `MainApplication.kt`
2. **Authentication Required**: Users must sign in to Medplum for core chat functionality  
3. **Subscription Context**: Detects RevenueCat is already initialized, proceeds with anonymous ID
4. **Result**: Subscriptions tied to device/installation, not patient identity

### Current Implementation Files
- `android/app/src/main/java/me/feelheard/MainApplication.kt` - Native RevenueCat initialization
- `contexts/SubscriptionContext.tsx` - Subscription management and RevenueCat interaction
- `utils/subscription/initialize-revenue-cat.ts` - RevenueCat configuration utilities
- `app/sign-in.tsx` - Medplum authentication flow

## Proposed Enhancement

### Target Flow
1. **App Launch**: RevenueCat starts anonymous (unchanged)
2. **Medplum Authentication**: User signs in (required for core functionality)
3. **User Identification**: **NEW** - Automatically link anonymous RevenueCat user to Patient ID
4. **Persistent Identity**: All future subscription actions tied to Patient ID

### Benefits
- ✅ **Cross-device sync** - Same subscriptions on multiple devices
- ✅ **Persistent history** - Survives app reinstalls
- ✅ **FHIR integration** - Subscription status in Patient records
- ✅ **Better analytics** - Track subscriptions per patient
- ✅ **Seamless UX** - No user action required for transition

## Implementation Status

✅ **COMPLETED** - Core user identification logic implemented successfully!

## Implementation Plan

### Phase 1: Core User Identification Logic ✅ COMPLETED

#### 1.1 Add User Identification to SubscriptionContext ✅ COMPLETED

**File**: `contexts/SubscriptionContext.tsx`
**Location**: After RevenueCat initialization confirmation (around line 520)

```typescript
// NEW: Link anonymous user to Patient ID after successful auth
const linkRevenueCatToPatient = async (): Promise<boolean> => {
  try {
    const profile = medplum.getProfile();
    if (!profile?.id) {
      console.log("📱 [SubscriptionContext] No patient profile available for linking");
      return false;
    }

    // Get current RevenueCat user ID
    const currentUserID = await Purchases.getAppUserID();
    
    // If already using Patient ID, skip
    if (currentUserID === profile.id) {
      console.log("📱 [SubscriptionContext] Already linked to Patient ID");
      return true;
    }

    // Log the linking attempt
    await logToCommunication("RevenueCat User Linking Started", {
      anonymousID: currentUserID,
      patientID: profile.id,
      platform: Platform.OS
    });

    // Link anonymous user to Patient ID
    await Purchases.logIn(profile.id);
    
    console.log(`📱 [SubscriptionContext] Successfully linked RevenueCat user from ${currentUserID} to ${profile.id}`);
    
    // Log successful linking
    await logToCommunication("RevenueCat User Linking Successful", {
      previousID: currentUserID,
      newPatientID: profile.id,
      platform: Platform.OS
    });

    return true;
  } catch (error) {
    console.error("📱 [SubscriptionContext] Failed to link RevenueCat user:", error);
    
    // Log linking failure
    await logToCommunication("RevenueCat User Linking Failed", {
      error: error instanceof Error ? error.message : String(error),
      platform: Platform.OS
    });
    
    return false;
  }
};
```

#### 1.2 Integration Point ✅ COMPLETED

**Location**: In the main useEffect after RevenueCat initialization success

**Implementation**: Added `linkRevenueCatToPatient()` call after successful customer info retrieval at line ~753 in SubscriptionContext.tsx. The function:

- ✅ Checks if user is authenticated via `medplum.getProfile()`
- ✅ Gets current RevenueCat user ID via `Purchases.getAppUserID()`
- ✅ Compares current ID vs Patient ID to avoid redundant linking
- ✅ Uses `Purchases.logIn(profile.id)` to link anonymous user to Patient ID
- ✅ Refreshes customer info after successful linking
- ✅ Comprehensive error handling and logging

### Phase 2: Authentication Flow Integration ✅ COMPLETED

#### 2.1 Post-Authentication Hook ✅ COMPLETED

**Implementation**: Leverages existing `useEffect(..., [medplum, ...])` dependency in SubscriptionContext.tsx (line 950). This automatically triggers user identification when:

- ✅ **Sign-in flow** completes (`app/sign-in.tsx`)
- ✅ **Registration flow** completes (`components/WebRegistration.tsx`)  
- ✅ **Any authentication state change** occurs

No additional integration needed - existing architecture handles all auth pathways automatically!

### Phase 3: Enhanced Logging & Monitoring ✅ COMPLETED

#### 3.1 User Identification Events ✅ COMPLETED

**Implementation**: Comprehensive logging added via Communication resources for:

- ✅ **Anonymous user creation** - Logged during initial RevenueCat initialization
- ✅ **Authentication events** - Logged via existing Medplum auth flow  
- ✅ **User linking attempts** - "RevenueCat User Linking Started" with anonymous/patient IDs
- ✅ **Linking success/failure** - "RevenueCat User Linking Successful/Failed" with details
- ✅ **Subscription transfer events** - Customer info refresh after linking

#### 3.2 FHIR Patient Record Integration

**Current State**: Subscription status is already stored in Patient extensions using:
```typescript
// Existing implementation in SubscriptionContext.tsx
{
  url: "https://progressnotes.app/fhir/StructureDefinition/subscription-status",
  valueString: JSON.stringify({
    customerId: info.originalAppUserId,           // Will become Patient ID after linking
    isPremium: checkPremiumEntitlement(info),     
    expirationDate: info.entitlements.active[ENTITLEMENT_IDS.PREMIUM]?.expiresDate,
    productIdentifier: info.entitlements.active[ENTITLEMENT_IDS.PREMIUM]?.productIdentifier,
  })
}
```

**Enhancement**: After user identification, the existing `customerId` field will automatically update from anonymous ID to Patient ID, providing:
- ✅ **Consistent customer tracking** across devices
- ✅ **Audit trail** of subscription changes
- ✅ **FHIR compliance** for subscription data

### Phase 4: Error Handling & Edge Cases ✅ COMPLETED

#### 4.1 Conflict Resolution ✅ COMPLETED

**Implementation**: Robust handling for:

- ✅ **Patient already has RevenueCat history** - `Purchases.logIn()` automatically merges subscriptions
- ✅ **Multiple anonymous users** - RevenueCat handles consolidation automatically
- ✅ **Network failures during linking** - Try/catch blocks with detailed error logging

#### 4.2 Graceful Fallbacks ✅ COMPLETED

**Implementation**: 

- ✅ **Continue with anonymous mode if linking fails** - Function returns boolean, app continues normally
- ✅ **Retry linking on subsequent app launches** - useEffect dependency on medplum retries automatically
- ✅ **Preserve existing subscription status** - Customer info refreshed after successful linking only

### Phase 5: Testing & Debugging Tools ✅ COMPLETED

#### 5.1 RevenueCatStatusPanel Enhancement ✅ COMPLETED

**Implementation**: Added "Test User Linking" button to `components/RevenueCatStatusPanel.tsx` that:

- ✅ Shows current RevenueCat User ID vs Patient ID
- ✅ Manually triggers user linking for testing
- ✅ Displays before/after user IDs
- ✅ Logs test results to Communication resources

## Testing Strategy

### 4.1 Test Scenarios

1. **Fresh Install + New User**
   - App launches → anonymous RevenueCat
   - User registers → Patient ID created  
   - Automatic linking → subscriptions tied to Patient

2. **Existing Anonymous User + Authentication**
   - User has anonymous purchases
   - User signs in → Patient ID linking
   - Verify purchases transfer to Patient ID

3. **Cross-Device Scenario**
   - User has subscriptions on Device A (Patient ID)
   - User signs in on Device B → should sync subscriptions
   - Verify both devices show same subscription status

4. **Network Failure Handling**
   - Simulate network failure during linking
   - Verify graceful fallback to anonymous mode
   - Verify retry on next app launch

### 4.2 Testing Tools

- Use `RevenueCatStatusPanel.tsx` for real-time monitoring
- Monitor Communication resources for linking events
- Test with RevenueCat sandbox environment
- Verify FHIR Patient record updates

## Rollout Plan

### Phase A: Development & Testing
- Implement core linking logic
- Test with development/staging environment
- Validate FHIR integration

### Phase B: Limited Release
- Deploy to test users
- Monitor linking success rates
- Gather UX feedback

### Phase C: Full Deployment
- Roll out to all users
- Monitor analytics and error rates
- Document any issues and resolutions

## Risk Assessment

### Low Risk
- ✅ **Backward Compatibility**: Existing anonymous users continue working
- ✅ **Graceful Degradation**: Falls back to anonymous mode on failure
- ✅ **No Breaking Changes**: Existing subscription logic unchanged

### Medium Risk
- ⚠️ **Network Dependencies**: Linking requires internet connectivity
- ⚠️ **RevenueCat API Changes**: Dependent on RevenueCat `logIn()` method behavior

### Mitigation Strategies
- Comprehensive error handling and retry logic
- Extensive testing with various network conditions
- Monitoring and alerting for linking failures

## Success Metrics

- **Linking Success Rate**: Target >95% successful anonymous-to-patient linking
- **Cross-Device Sync**: Users see consistent subscription status across devices  
- **Support Ticket Reduction**: Fewer subscription-related support issues
- **User Retention**: Improved retention due to persistent subscription access

## Future Enhancements

- **Proactive Patient Linking**: Link during registration flow
- **Subscription History UI**: Show subscription history in app
- **Advanced Analytics**: Track subscription patterns by patient cohorts
- **Family Sharing**: Support for family/household subscription management