# RevenueCat User Switching Implementation Plan

## Executive Summary

**Issue:** User linking via `Purchases.logIn()` creates dual identity where `getAppUserID()` returns Patient ID but `getCustomerInfo()` returns stale anonymous ID.

**Root Cause:** Customer info cache is not properly invalidated after `logIn()`, causing `getCustomerInfo()` to return stale data while `getAppUserID()` returns correct Patient ID.

**Solution:** Add aggressive cache invalidation after `logIn()` and improve verification logic to ensure complete identity switch.

## Evidence from Testing

### Current State Analysis
**Manual User Linking Test (Working):**
```json
"currentUserID": "01969ccc-37e7-761a-a31e-405b20337a1d"  // getAppUserID() - correct
"newID": "01969ccc-37e7-761a-a31e-405b20337a1d"         // getAppUserID() - correct
```

**Subscription Context (Failing):**
```json
"originalAppUserId": "$RCAnonymousID:7c7ecb49214d4da4aeab1ebc6624f616"  // getCustomerInfo() - stale
```

**Bridge Diagnostic (Healthy):**
```json
"bridgeMethodCheck": {
  "hasSetup": false,           // ✅ Deprecated method eliminated
  "hasSetupPurchases": true,   // ✅ Native v8 methods available
  "hasGetAppUserID": true      // ✅ Core methods working
}
```

## Technical Analysis

### Current Flow Problems
1. **App Launch:** RevenueCat configured with anonymous user
2. **User Signs In:** `Purchases.logIn(patientID)` creates linked identity
3. **Identity Split:** getAppUserID() shows Patient ID, getCustomerInfo() shows anonymous
4. **Cache Confusion:** Customer info cache tied to original anonymous session
5. **UI Shows Stale Data:** Debug panel displays anonymous Customer ID

### RevenueCat Identity Methods Analysis

Based on research of react-native-purchases v8.10.0:

| Method | Availability | Purpose | Notes |
|--------|-------------|---------|-------|
| `logIn()` | ✅ Available | Switch between users | **Can switch directly without logOut()** |
| `switchUser()` | ❌ Not Available | N/A | Method doesn't exist in react-native-purchases |
| `logOut()` | ✅ Available | Switch to anonymous | Creates new anonymous user |
| `invalidateCustomerInfoCache()` | ✅ Available | Force cache refresh | Critical for ensuring fresh data |

### Key Insight from RevenueCat Documentation

**Direct User Switching with logIn():**
> "If you currently have a user logged in to an identified user ID and they want to switch to another app user ID that is custom, you can just use the login() method and pass in that app user ID rather than calling logout() first."

**Our Issue:** Not a `logIn()` problem, but a **cache invalidation problem**.

## Implementation Plan

### Phase 1: Update User Linking Logic ⚠️ CRITICAL

#### File: `contexts/SubscriptionContext.tsx`
**Location:** `linkRevenueCatToPatient()` function (lines ~276)

**Current Code:**
```typescript
// Link anonymous user to Patient ID
await Purchases.logIn(profile.id);
```

**New Code:**
```typescript
// Switch to Patient ID (logIn handles user switching correctly)
await Purchases.logIn(profile.id);

// CRITICAL: Force complete cache invalidation
await Purchases.invalidateCustomerInfoCache();

// Additional safety: wait for cache to clear
await new Promise(resolve => setTimeout(resolve, 500));
```

**Rationale:**
- `logIn()` correctly switches users per RevenueCat documentation
- `invalidateCustomerInfoCache()` forces fresh data retrieval
- Small delay ensures cache invalidation completes
- Eliminates stale customer info issues

### Phase 2: Update Test Function ⚠️ IMPORTANT

#### File: `components/RevenueCatStatusPanel.tsx`
**Location:** `testUserLinking()` function (lines ~143-184)

**Current Code:**
```typescript
// Perform the linking
await Purchases.logIn(profile.id);
```

**New Code:**
```typescript
// Switch to Patient ID
await Purchases.logIn(profile.id);

// Invalidate cache to ensure fresh data
await Purchases.invalidateCustomerInfoCache();

// Wait for cache invalidation
await new Promise(resolve => setTimeout(resolve, 500));
```

**Rationale:**
- Keep manual test consistent with production logic
- Verify cache invalidation behavior in controlled test
- Same logic as production implementation

### Phase 3: Enhanced Logging and Verification 🔍 RECOMMENDED

#### File: `contexts/SubscriptionContext.tsx`
**Location:** After switchUser() call

**Add Verification Logic:**
```typescript
await Purchases.logIn(profile.id);
await Purchases.invalidateCustomerInfoCache();
await new Promise(resolve => setTimeout(resolve, 500));

// Verify the switch was successful
const verificationUserID = await Purchases.getAppUserID();
const verificationCustomerInfo = await Purchases.getCustomerInfo();

await logToCommunication("User Switch Verification", {
  expectedPatientID: profile.id,
  actualUserID: verificationUserID,
  actualCustomerInfoID: verificationCustomerInfo.originalAppUserId,
  switchSuccessful: verificationUserID === profile.id && 
                   verificationCustomerInfo.originalAppUserId === profile.id,
  cacheInvalidated: true,
  platform: Platform.OS
});

if (verificationUserID === profile.id && 
    verificationCustomerInfo.originalAppUserId === profile.id) {
  console.log("📱 [SubscriptionContext] User switch verified - both IDs match Patient ID");
  return true;
} else {
  console.warn("📱 [SubscriptionContext] User switch verification failed - ID mismatch detected");
  await logToCommunication("User Switch Verification Failed", {
    expectedPatientID: profile.id,
    actualUserID: verificationUserID,
    actualCustomerInfoID: verificationCustomerInfo.originalAppUserId,
    platform: Platform.OS
  });
  return false;
}
```

### Phase 4: Remove Enhanced Retry Logic 🧹 CLEANUP

#### File: `contexts/SubscriptionContext.tsx`
**Location:** Customer info refresh after linking (lines ~755-809)

**Current State:** Complex retry logic with 3 attempts
**New Approach:** Simple refresh since switchUser() should eliminate the problem

**Simplified Code:**
```typescript
if (linkingSuccess) {
  console.log("📱 [SubscriptionContext] User switch successful, refreshing customer info");
  
  try {
    // Simple refresh since cache invalidation should have resolved identity issues
    const updatedInfo = await safelyExecuteRevenueCatMethod(
      "getCustomerInfo",
      () => Purchases.getCustomerInfo(),
      null,
    );
    
    if (updatedInfo) {
      setCustomerInfo(updatedInfo);
      console.log(`📱 [SubscriptionContext] Customer info updated - ID: ${updatedInfo.originalAppUserId}`);
      
      await logToCommunication("Customer Info Updated After Switch", {
        newCustomerID: updatedInfo.originalAppUserId,
        platform: Platform.OS
      });
    }
  } catch (refreshError) {
    console.warn("📱 [SubscriptionContext] Failed to refresh customer info after switch:", refreshError);
    
    await logToCommunication("Customer Info Refresh Failed After Switch", {
      error: refreshError instanceof Error ? refreshError.message : String(refreshError),
      platform: Platform.OS
    });
  }
}
```

## Testing Strategy

### Test Scenario 1: Clean App Install
1. **Install fresh app** → Should start with anonymous RevenueCat ID
2. **Sign in to Medplum** → Should trigger switchUser() to Patient ID
3. **Check debug panel** → Customer ID should show Patient ID immediately
4. **Verify logs** → Should show "User Switch Verification" success

### Test Scenario 2: Existing Anonymous User
1. **Use app anonymously** → Establish anonymous RevenueCat session
2. **Make test purchase** → Create anonymous subscription history
3. **Sign in** → Should switch to Patient ID and transfer subscriptions
4. **Verify subscription transfer** → Premium status should persist

### Test Scenario 3: Multiple Sign-ins
1. **Sign in as User A** → Should switch to Patient ID A
2. **Sign out and sign in as User B** → Should switch to Patient ID B
3. **Verify clean separation** → No cross-contamination of data

### Test Scenario 4: Network Failure Handling
1. **Sign in with poor connectivity** → Should handle switchUser() failures gracefully
2. **Verify fallback** → Should maintain anonymous mode if switch fails
3. **Retry on reconnect** → Should attempt switch again when connectivity restored

## Risk Assessment

### Low Risk ✅
- **switchUser() is standard RevenueCat API** - well-documented and supported
- **Maintains existing subscription benefits** - user keeps premium status
- **No configuration changes needed** - uses existing RevenueCat setup

### Medium Risk ⚠️
- **Subscription history transfer** - need to verify anonymous purchases transfer to Patient ID
- **Cache timing issues** - small window where customer info might be inconsistent
- **Network failure scenarios** - switchUser() might fail during poor connectivity

### High Risk ❌
- **Loss of anonymous purchases** - if switchUser() doesn't transfer subscription history
- **Breaking existing users** - current users might lose their subscription status

## Mitigation Strategies

### Subscription Preservation
```typescript
// Before switchUser(), verify current subscription status
const preWwitchCustomerInfo = await Purchases.getCustomerInfo();
const hadPremiumBefore = checkPremiumEntitlement(preSwitchCustomerInfo);

await Purchases.switchUser(profile.id);

// After switchUser(), verify subscription transferred
const postSwitchCustomerInfo = await Purchases.getCustomerInfo();
const hasPremiumAfter = checkPremiumEntitlement(postSwitchCustomerInfo);

if (hadPremiumBefore && !hasPremiumAfter) {
  // Log critical issue and attempt recovery
  await logToCommunication("CRITICAL: Subscription Lost During Switch", {
    preSwitchID: preSwitchCustomerInfo.originalAppUserId,
    postSwitchID: postSwitchCustomerInfo.originalAppUserId,
    platform: Platform.OS
  });
  
  // Attempt to restore purchases
  await Purchases.restorePurchases();
}
```

### Gradual Rollout
1. **Phase A:** Implement with extensive logging, monitor for 1 week
2. **Phase B:** If successful, remove complex retry logic and simplify
3. **Phase C:** Deploy to all users after verification

## Success Metrics

### Immediate Success (Phase 1)
- ✅ **Customer ID consistency:** Both getAppUserID() and getCustomerInfo() return Patient ID
- ✅ **No "Customer Info Refresh Failed" logs** 
- ✅ **Debug panel shows Patient ID immediately** after sign-in

### Long-term Success (Phase 2-3)  
- ✅ **Zero user linking failures** in Communication logs
- ✅ **Subscription continuity** - all users retain premium status after switch
- ✅ **Cross-device sync works** - same Patient ID on multiple devices

### Performance Metrics
- ✅ **Faster sign-in flow** - no retry loops needed
- ✅ **Reduced support tickets** - consistent subscription status
- ✅ **Clean audit trail** - all RevenueCat events tied to Patient ID

## Rollback Plan

If switchUser() causes issues:

### Immediate Rollback
```typescript
// Revert to logIn() approach
await Purchases.logIn(profile.id);

// Keep enhanced retry logic as safety net
// (existing code in lines 755-809)
```

### Alternative Approaches
1. **Option A:** Use `setAppUserID()` instead of `switchUser()`
2. **Option B:** Force reconfigure RevenueCat after authentication
3. **Option C:** Implement manual subscription transfer logic

## Files to Review and Modify

### Primary Files
1. **`contexts/SubscriptionContext.tsx`** - Main user linking logic
2. **`components/RevenueCatStatusPanel.tsx`** - Manual test function

### Documentation Files
3. **`docs/revenuecat-bridge-corruption-fix-strategy.md`** - Update with new approach
4. **`docs/revenuecat-user-identification-implementation.md`** - Mark as superseded

### Configuration Files (No changes needed)
- **`android/app/src/main/java/me/feelheard/MainApplication.kt`** - Native config unchanged
- **`utils/subscription/initialize-revenue-cat.ts`** - JS config unchanged

## Implementation Checklist

### Phase 1: Core Changes
- [ ] Update `linkRevenueCatToPatient()` to use `switchUser()`
- [ ] Add `invalidateCustomerInfoCache()` call
- [ ] Update `testUserLinking()` function
- [ ] Add verification logging

### Phase 2: Testing
- [ ] Test clean app install → sign-in flow
- [ ] Test existing anonymous user → sign-in flow  
- [ ] Verify subscription preservation
- [ ] Check cross-device sync

### Phase 3: Cleanup (Optional)
- [ ] Simplify customer info refresh logic
- [ ] Remove complex retry mechanisms
- [ ] Update documentation

### Phase 4: Monitoring
- [ ] Monitor Communication logs for success/failure patterns
- [ ] Track subscription continuity metrics
- [ ] Verify Customer ID consistency across all components

---

**Created:** May 25, 2025  
**Status:** 📋 READY FOR IMPLEMENTATION  
**Priority:** Critical - Clean solution to dual identity problem  
**Estimated Impact:** Complete resolution of Customer ID inconsistency issues