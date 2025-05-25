# RevenueCat Bridge Corruption Fix Strategy

## Executive Summary

**Issue:** RevenueCat user linking appears successful but Customer ID remains anonymous due to native bridge corruption caused by deprecated API usage.

**Root Cause:** React Native code trying to call deprecated `Purchases.setup()` method (removed in v8.x) while native Android uses correct `Purchases.configure()`, causing bridge method mismatch and silent failures.

**Impact:** 
- ✅ User linking logs show "success" 
- ❌ Customer ID stuck on anonymous ID
- ❌ Manual refresh buttons don't work
- ❌ Cross-device subscription sync broken

## Technical Analysis

### Current Configuration
- **React Native SDK:** `react-native-purchases@8.10.0` ✅
- **Native Android SDK:** `com.revenuecat.purchases:purchases:8.10.0` ✅  
- **Native Initialization:** Uses `Purchases.configure()` ✅
- **React Native Calls:** Some code tries `Purchases.setup()` ❌

### Bridge Corruption Mechanism

1. **Native Android** (MainApplication.kt) correctly initializes with `Purchases.configure()`
2. **React Native** debug panel tries to call `NativeModules.RNPurchases.setup()` 
3. **Bridge Method Mismatch** - `setup` doesn't exist in v8.x, only `configure`
4. **Silent Failure Chain:**
   - Bridge becomes unreliable for method calls
   - `logIn()` appears successful but doesn't persist
   - `getCustomerInfo()` returns stale/cached data
   - React state never updates with new Customer ID

### Evidence from Screenshots
- Customer ID shows `$RCAnonymousID:...ebc6624f616` (stale)
- Native Method Error: `"setup method not available on RNPurchases"`
- User linking test shows correct Patient ID but UI doesn't reflect it
- Manual refresh buttons fail to update displayed data

## Files Requiring Fixes

### 1. RevenueCatStatusPanel.tsx ❌ CRITICAL
**Issue:** Line 97 calls deprecated `NativeModules.RNPurchases.setup()`

**Current Code:**
```typescript
if (typeof NativeModules.RNPurchases.setup === "function") {
  NativeModules.RNPurchases.setup(
    apiKey,
    null, // appUserID  
    true, // observerMode
    {}, // userDefaultsSuiteName
    successCallback,
    errorCallback
  );
}
```

**Fix Required:** Replace with v8.x compatible `setupPurchases` or remove entirely

### 2. SubscriptionContext.tsx ✅ MOSTLY GOOD
**Analysis:** Uses correct `Purchases.configure()` API throughout
**Issue:** Customer info refresh after linking may need strengthening

### 3. initialize-revenue-cat.ts ✅ GOOD  
**Analysis:** Uses correct `Purchases.configure()` API
**Status:** No changes needed

### 4. MainApplication.kt ✅ GOOD
**Analysis:** Native initialization uses correct `Purchases.configure()`
**Status:** No changes needed

## Fix Implementation Plan

### Phase 1: Remove Deprecated API Calls ⚠️ CRITICAL

#### Fix 1.1: RevenueCatStatusPanel.tsx
**Action:** Replace deprecated setup call with configure or diagnostic-only approach

**SELECTED APPROACH - Option B: Diagnostic Only**

**Rationale for Option B:**
- Debug panels should be diagnostic only, not perform initialization
- RevenueCat already properly initialized in MainApplication.kt (native) and SubscriptionContext.tsx (JS)
- Multiple initialization points create race conditions and conflicts
- Current setup call uses `observerMode: true` which creates read-only instance (wrong for purchases)
- Diagnostic approach provides more valuable debugging information

**Implementation - Replace with Pure Diagnostics:**
```typescript
// Replace attemptDirectNativeCall() function entirely with:
const attemptBridgeDiagnostic = () => {
  // Log initial attempt to Communication
  logToCommunication("Native Bridge Diagnostic Started", {
    platform: Platform.OS
  });

  if (!NativeModules.RNPurchases) {
    const errorMsg = "RNPurchases native module is not available";
    Alert.alert("Native Module Error", errorMsg);
    logToCommunication("Native Module Error", { error: errorMsg });
    return;
  }

  const diagnosticInfo = {
    hasRNPurchases: !!NativeModules.RNPurchases,
    availableMethods: NativeModules.RNPurchases 
      ? Object.getOwnPropertyNames(NativeModules.RNPurchases)
      : [],
    bridgeMethodCheck: {
      hasSetup: typeof NativeModules.RNPurchases?.setup === "function",
      hasSetupPurchases: typeof NativeModules.RNPurchases?.setupPurchases === "function", 
      hasConfigure: typeof NativeModules.RNPurchases?.configure === "function",
      hasGetAppUserID: typeof NativeModules.RNPurchases?.getAppUserID === "function"
    },
    jsSDKMethods: {
      hasConfigure: typeof Purchases.configure === "function",
      hasIsConfigured: typeof Purchases.isConfigured === "function",
      hasGetAppUserID: typeof Purchases.getAppUserID === "function",
      hasLogIn: typeof Purchases.logIn === "function"
    },
    sdkVersion: Purchases?.VERSION || "unknown",
    platform: Platform.OS,
    timestamp: new Date().toISOString()
  };

  Alert.alert("Bridge Diagnostic", JSON.stringify(diagnosticInfo, null, 2));
  logToCommunication("Native Bridge Diagnostic Complete", diagnosticInfo);
};
```

**Button Label Update:**
```typescript
// Change button text from "Try Native Call" to "Bridge Diagnostic"
<Pressable
  style={[styles.button, { backgroundColor: "#ff9800" }]}
  onPress={attemptBridgeDiagnostic}
>
  <Text style={styles.buttonText}>Bridge Diagnostic</Text>
</Pressable>
```

### Phase 2: Strengthen User Linking ⚠️ IMPORTANT

#### Fix 2.1: Enhanced Customer Info Refresh
**File:** `contexts/SubscriptionContext.tsx`
**Location:** Lines 759-771 (after user linking)

**Current Issue:** Silent failure in customer info refresh
**Enhancement:** Add retry logic and force refresh

```typescript
if (linkingSuccess) {
  console.log("📱 [SubscriptionContext] User linking successful, refreshing customer info");
  
  // Enhanced refresh with retry logic
  let refreshAttempts = 0;
  const maxAttempts = 3;
  let refreshSuccess = false;
  
  while (refreshAttempts < maxAttempts && !refreshSuccess) {
    try {
      refreshAttempts++;
      console.log(`📱 [SubscriptionContext] Customer info refresh attempt ${refreshAttempts}/${maxAttempts}`);
      
      // Add small delay to allow backend sync
      await new Promise(resolve => setTimeout(resolve, 1000 * refreshAttempts));
      
      const updatedInfo = await safelyExecuteRevenueCatMethod(
        "getCustomerInfo",
        () => Purchases.getCustomerInfo(),
        null,
      );
      
      if (updatedInfo && updatedInfo.originalAppUserId !== info?.originalAppUserId) {
        setCustomerInfo(updatedInfo);
        console.log(`📱 [SubscriptionContext] Customer info updated successfully on attempt ${refreshAttempts}`);
        console.log(`📱 [SubscriptionContext] New Customer ID: ${updatedInfo.originalAppUserId}`);
        refreshSuccess = true;
        
        await logToCommunication("Customer Info Refresh Success", {
          attempt: refreshAttempts,
          oldCustomerId: info?.originalAppUserId,
          newCustomerId: updatedInfo.originalAppUserId,
          platform: Platform.OS
        });
      } else if (refreshAttempts === maxAttempts) {
        console.warn(`📱 [SubscriptionContext] Customer info still showing old ID after ${maxAttempts} attempts`);
        await logToCommunication("Customer Info Refresh Failed", {
          attempts: maxAttempts,
          currentCustomerId: updatedInfo?.originalAppUserId,
          expectedChange: true,
          platform: Platform.OS
        });
      }
    } catch (refreshError) {
      console.warn(`📱 [SubscriptionContext] Refresh attempt ${refreshAttempts} failed:`, refreshError);
      if (refreshAttempts === maxAttempts) {
        await logToCommunication("Customer Info Refresh Error", {
          attempts: maxAttempts,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError),
          platform: Platform.OS
        });
      }
    }
  }
}
```

### Phase 3: Add Bridge Health Monitoring 🔍 RECOMMENDED

#### Fix 3.1: Bridge Health Check Function
**File:** `contexts/SubscriptionContext.tsx`
**Location:** Add new utility function

```typescript
const checkBridgeHealth = async (): Promise<boolean> => {
  try {
    // Test multiple RevenueCat methods to verify bridge integrity
    const tests = [
      { name: 'getAppUserID', fn: () => Purchases.getAppUserID() },
      { name: 'isConfigured', fn: () => Purchases.isConfigured() },
      { name: 'getCustomerInfo', fn: () => Purchases.getCustomerInfo() }
    ];
    
    const results = [];
    for (const test of tests) {
      try {
        const result = await test.fn();
        results.push({ [test.name]: 'success', result });
      } catch (error) {
        results.push({ [test.name]: 'failed', error: String(error) });
      }
    }
    
    await logToCommunication("Bridge Health Check", {
      results,
      platform: Platform.OS,
      timestamp: new Date().toISOString()
    });
    
    // Bridge is healthy if at least 2 out of 3 tests pass
    const successCount = results.filter(r => Object.values(r)[0] === 'success').length;
    return successCount >= 2;
  } catch (error) {
    await logToCommunication("Bridge Health Check Failed", {
      error: error instanceof Error ? error.message : String(error),
      platform: Platform.OS
    });
    return false;
  }
};
```

#### Fix 3.2: Pre-Linking Bridge Health Check
**Integration:** Call before user linking attempt

```typescript
// Before user linking in linkRevenueCatToPatient()
const bridgeHealthy = await checkBridgeHealth();
if (!bridgeHealthy) {
  console.warn("📱 [SubscriptionContext] Bridge health check failed, user linking may not work properly");
  await logToCommunication("User Linking Skipped - Bridge Unhealthy", {
    platform: Platform.OS
  });
  return false;
}
```

## Testing Strategy

### Test Scenario 1: Clean Build Verification
1. **Clean build and install** new APK
2. **Sign in** and check Customer ID immediately  
3. **Expected:** Customer ID shows Patient ID (not anonymous)
4. **If still anonymous:** Bridge corruption persists, proceed to manual fixes

### Test Scenario 2: Bridge Health Monitoring
1. **Check RevenueCat logs** for "Bridge Health Check" entries
2. **Verify** all three methods (getAppUserID, isConfigured, getCustomerInfo) pass
3. **If failures:** Indicates specific bridge method corruption

### Test Scenario 3: Enhanced Refresh Testing  
1. **Trigger user linking** manually via debug panel
2. **Monitor logs** for "Customer Info Refresh Success/Failed" entries
3. **Check retry attempts** and final Customer ID result
4. **Expected:** Customer ID updates within 3 attempts

## Risk Assessment

### Low Risk ✅
- **Native initialization works** - Android SDK properly configured
- **Basic RevenueCat functions work** - purchases, entitlements function properly
- **User linking logs succeed** - the core linking API call works

### Medium Risk ⚠️
- **Customer info refresh failures** - may require app restart to sync
- **UI state inconsistency** - displayed info may lag behind actual state
- **Debug panel corruption** - diagnostic features may be unreliable

### High Risk ❌  
- **Bridge method mismatch** - deprecated API calls corrupt entire bridge
- **Silent failure cascade** - multiple methods start returning stale data
- **Cross-device sync broken** - user linking doesn't persist properly

## Success Metrics

### Immediate Fixes (Phase 1)
- ✅ **No "setup method not available" errors** in logs
- ✅ **Bridge health check passes** for all methods
- ✅ **Clean build shows Patient ID** immediately after sign-in

### Enhanced Reliability (Phase 2) 
- ✅ **Customer info refresh succeeds** within 3 attempts after linking
- ✅ **Manual refresh buttons work** and update displayed Customer ID
- ✅ **Consistent Customer ID** across all UI components

### Long-term Stability (Phase 3)
- ✅ **Bridge health monitoring** detects issues proactively  
- ✅ **Cross-device sync works** reliably
- ✅ **User support tickets reduced** for subscription issues

## Implementation Status

1. **✅ COMPLETED:** Fix RevenueCatStatusPanel.tsx deprecated setup() call
2. **✅ COMPLETED:** Enhance customer info refresh with retry logic
3. **🔍 READY:** Add bridge health monitoring and diagnostics (optional)
4. **📊 READY:** Implement comprehensive logging and metrics (optional)

## Rollback Plan

If fixes cause regressions:

1. **Revert** RevenueCatStatusPanel.tsx to remove deprecated calls entirely
2. **Fall back** to native-only initialization (remove all JS configure calls)
3. **Disable** user linking temporarily until bridge issues resolved
4. **Document** specific error patterns for further investigation

---

## Implementation Complete ✅

**Critical Fixes Applied:**

1. **✅ RevenueCatStatusPanel.tsx Fixed**
   - Removed deprecated `Purchases.setup()` call that was causing bridge corruption
   - Replaced with comprehensive bridge diagnostic function
   - Changed button from "Try Native Call" to "Bridge Diagnostic"

2. **✅ SubscriptionContext.tsx Enhanced**
   - Added retry logic (3 attempts) for customer info refresh after user linking
   - Added progressive delays (1s, 2s, 3s) to allow backend sync
   - Added detailed logging for refresh success/failure tracking
   - Compares old vs new Customer IDs to verify linking worked

**Expected Results:**
- ❌ No more "setup method not available" errors
- ✅ Customer ID should update from anonymous to Patient ID after user linking
- ✅ Manual refresh buttons should work properly
- ✅ Bridge diagnostic provides valuable debugging information

**Testing Instructions:**
1. Build and install the updated app
2. Sign in to trigger user linking
3. Check if Customer ID shows Patient ID immediately
4. If still anonymous, use "Bridge Diagnostic" button to check bridge health
5. Monitor "RevenueCat Logs" for refresh success/failure messages

---

**Created:** May 25, 2025  
**Status:** ✅ IMPLEMENTED - Critical fixes complete  
**Priority:** Critical - Bridge corruption affecting core subscription functionality