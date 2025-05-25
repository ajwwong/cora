# RevenueCat Android Integration Implementation Plan

## Overview

This document outlines the implementation plan to resolve the RevenueCat initialization issues in the FeelHeard Android app. The core issue identified is that the React Native bridge isn't properly initializing the RevenueCat native module before JavaScript code attempts to use it, resulting in "There is no singleton instance" errors.

## Problem Diagnosis

Based on our analysis, we're encountering the following issues:

1. **Bridge Initialization Timing**: The JavaScript context loads and attempts to use RevenueCat before the native module is fully initialized.
2. **Native Module Registration**: While the RNPurchases native module appears to be registered, its methods aren't properly accessible from JavaScript.
3. **Configuration Failure**: Calls to `Purchases.configure()` from JavaScript fail because the native module isn't properly initialized.

## Proposed Solution

Our solution will implement a dual-approach strategy to ensure RevenueCat is initialized properly:

### 1. Native-side Initialization (Primary Solution)

We'll add explicit RevenueCat initialization in the Android `MainApplication.kt` file to ensure it's initialized before the React Native bridge loads.

### 2. JavaScript-side Resilience (Fallback Support)

We'll enhance our JavaScript initialization code to be more resilient, with better error handling and verification of initialization status.

## Implementation Steps

### Phase 1: Native Android Implementation

1. **Update MainApplication.kt**

```kotlin
package me.feelheard

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

// RevenueCat imports
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.LogLevel

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(MyReactNativePackage())
            return packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    
    // Initialize RevenueCat before React initialization
    try {
      Log.d("RevenueCat", "Initializing RevenueCat from MainApplication.kt")
      
      // Set log level to VERBOSE for debugging
      Purchases.logLevel = LogLevel.VERBOSE
      
      // Use the API key from our config
      val revenueCatApiKey = "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo" // Google Play key
      
      // Create the configuration
      val configuration = PurchasesConfiguration.Builder(this, revenueCatApiKey)
        .build()
      
      // Configure RevenueCat
      Purchases.configure(configuration)
      
      Log.d("RevenueCat", "Successfully initialized RevenueCat in native code")
    } catch (e: Exception) {
      Log.e("RevenueCat", "Failed to initialize RevenueCat in native code", e)
    }
    
    // Continue with normal React Native initialization
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
```

2. **Update build.gradle Dependencies**

Ensure the build.gradle file has the necessary RevenueCat dependencies:

```gradle
// In android/app/build.gradle
dependencies {
  // ... other dependencies
  
  // RevenueCat dependencies
  implementation 'com.revenuecat.purchases:purchases:6.9.0'
}
```

### Phase 2: JavaScript Implementation Improvements

1. **Update initialize-revenue-cat.ts**

```typescript
/**
 * Initialize RevenueCat with retries and resilient approach
 */
export const initializeRevenueCat = async (
  medplum: MedplumClient  < /dev/null |  null = null,
): Promise<boolean> => {
  // Update status
  initializationAttempted = true;
  revenueCatStatus.initializationAttempted = true;

  // Skip for web platform
  if (Platform.OS === "web") {
    const message = "Web platform detected, skipping RevenueCat initialization";
    await showVisibleMessage("RevenueCat Info", message, false, medplum);
    return false;
  }

  // Wait a short moment to ensure native module is registered
  await new Promise(resolve => setTimeout(resolve, 100));
    
  try {
    // Check if Purchases is a proper object with methods
    const purchasesType = typeof Purchases;
    const hasConfigureMethod = typeof Purchases.configure === 'function';
    const hasIsConfiguredMethod = typeof Purchases.isConfigured === 'function';
    
    await logToCommunication(medplum, 'RevenueCat Initialization Check', {
      purchasesType,
      hasConfigureMethod,
      hasIsConfiguredMethod,
      platform: Platform.OS
    });

    // First check if already configured by native side
    if (hasIsConfiguredMethod) {
      try {
        const alreadyConfigured = Purchases.isConfigured();
        
        if (alreadyConfigured) {
          showVisibleMessage("RevenueCat", "Already configured by native module");
          
          // Verify with a method call
          try {
            if (typeof Purchases.getAppUserID === 'function') {
              const appUserId = await Purchases.getAppUserID();
              showVisibleMessage("RevenueCat", `Verified with getAppUserID: ${appUserId}`);
              
              // Everything is working - mark as initialized
              isInitialized = true;
              revenueCatStatus.isInitialized = true;
              
              await logToCommunication(medplum, "RevenueCat already configured by native module", {
                platform: Platform.OS,
                environment: __DEV__ ? "development" : "production",
                appUserId
              });
              
              return true;
            }
          } catch (verifyError) {
            showVisibleMessage("RevenueCat Warning", 
              `isConfigured() returns true but verification failed: ${verifyError}`, 
              true);
            
            // Continue with JS configuration as fallback
          }
        }
      } catch (configError) {
        // Continue with JS configuration if checking fails
        showVisibleMessage("RevenueCat", 
          `Error checking configuration status: ${configError}, will attempt JS configuration`);
      }
    }
    
    // If we reach here, we need to configure with JS
    // Get the appropriate API key for the platform
    const apiKey = Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;
      
    // Set verbose logging in development
    if (__DEV__ && typeof Purchases.setLogLevel === "function") {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
    }
      
    // Try to configure (will succeed if native module is properly registered)
    if (hasConfigureMethod) {
      try {
        Purchases.configure({ apiKey });
        showVisibleMessage("RevenueCat", "Configured from JavaScript");
          
        // Verify configuration worked with a method call
        if (typeof Purchases.getAppUserID === 'function') {
          try {
            const appUserId = await Purchases.getAppUserID();
            showVisibleMessage("RevenueCat", `Verified with getAppUserID: ${appUserId}`);
            
            isInitialized = true;
            revenueCatStatus.isInitialized = true;
            
            await logToCommunication(medplum, "RevenueCat JS configuration successful", {
              platform: Platform.OS,
              environment: __DEV__ ? "development" : "production",
              appUserId
            });
            
            return true;
          } catch (verifyError) {
            showVisibleMessage("RevenueCat Error", 
              `Verification failed after JS configuration: ${verifyError}`, 
              true);
            
            await logToCommunication(medplum, "RevenueCat verification failed after JS configure", {
              platform: Platform.OS,
              environment: __DEV__ ? "development" : "production",
              error: String(verifyError)
            });
            
            return false;
          }
        }
      } catch (configError) {
        showVisibleMessage("RevenueCat Error", `JS configuration failed: ${configError}`, true);
        
        await logToCommunication(medplum, "RevenueCat JS configuration failed", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          error: String(configError)
        });
        
        return false;
      }
    } else {
      showVisibleMessage("RevenueCat Error", "Configure method not available", true);
      
      await logToCommunication(medplum, "RevenueCat configure method not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production"
      });
      
      return false;
    }
    
    // If we get here but initialization is still not detected, return false
    if (\!isInitialized) {
      showVisibleMessage("RevenueCat Error", "Initialization process completed but status checks failed", true);
      return false;
    }
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    showVisibleMessage("RevenueCat Error", `Initialization failed: ${errorMessage}`, true);
    
    await logToCommunication(medplum, "RevenueCat initialization failed", {
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
      error: errorMessage,
    });
    
    return false;
  }
};
```

### Phase 3: Android Manifest Updates

Ensure the AndroidManifest.xml contains the proper permissions:

```xml
<manifest>
    <\!-- ... other entries -->
    <uses-permission android:name="com.android.vending.BILLING" />
    <uses-permission android:name="android.permission.INTERNET" />
    <\!-- ... -->
</manifest>
```

## Testing Plan

1. **Build Process Verification**:
   - Run `npx expo prebuild --clean` to regenerate native projects
   - Build debug APK with `./scripts/build-debug-apk.sh`
   - Build release APK with `./scripts/clean-and-build-apk.sh`

2. **Runtime Verification**:
   - Check Android logcat for "Successfully initialized RevenueCat in native code" message
   - Verify the RevenueCat SDK initialization in the app with debug panel
   - Test the purchase flow for a premium subscription

3. **Error State Testing**:
   - Test with invalid API key to verify error handling
   - Test with network disabled to verify offline behavior

## Deployment Strategy

1. **Internal Testing**:
   - Deploy to internal testers with debug logging enabled
   - Collect logs from test devices
   - Verify subscription status sync with backend

2. **Production Deployment**:
   - Remove excessive debug logging and alerts
   - Build final production APK/AAB
   - Deploy to Google Play

## Fallback Strategy

If the native initialization approach doesn't resolve the issue:

1. Explore using a custom NativeModule to bridge initialization
2. Consider downgrading to an earlier version of react-native-purchases (e.g., v8.8.0)
3. Contact RevenueCat support with detailed logs from this implementation

## Monitoring and Validation

After deployment, monitor:

1. RevenueCat dashboard for successful purchases
2. Error logs in production for any initialization failures
3. User reports of subscription issues

## Timeline

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | Native Android Implementation | 1 day |
| 2 | JavaScript Implementation | 1 day |
| 3 | Testing and Verification | 2 days |
| 4 | Production Deployment | 1 day |

## Implementation Details

### 1. Changes Made

We've implemented the following changes to fix the RevenueCat Android integration:

1. **MainApplication.kt Updates**:
   - Added RevenueCat imports
   - Added native initialization in the `onCreate()` method
   - Added extensive error handling and logging

2. **build.gradle Updates**:
   - Added explicit RevenueCat dependency: `implementation 'com.revenuecat.purchases:purchases:6.9.0'`

3. **initialize-revenue-cat.ts Improvements**:
   - Added delay to ensure native module registration is complete
   - Improved error handling with more detailed logging
   - Added better verification checks for native initialization
   - Streamlined the initialization flow with clear fallback paths

4. **AndroidManifest.xml Check**:
   - Verified that required permissions are already present:
     - `<uses-permission android:name="com.android.vending.BILLING"/>`
     - `<uses-permission android:name="android.permission.INTERNET"/>`

### 2. Build and Test Instructions

#### Rebuilding the Android App

After making these changes, follow these steps to build and test the Android app:

1. **Clean and Rebuild Native Modules**:
   ```bash
   # Clear Expo cache and rebuild native code
   npx expo prebuild --clean
   ```

2. **Build Debug APK**:
   ```bash
   # Build debug APK for testing
   ./scripts/build-debug-apk.sh
   ```

3. **Install on Device**:
   ```bash
   # Install APK on connected device
   adb install -r ./android/app/build/outputs/apk/debug/app-debug.apk
   ```

#### Testing the Implementation

1. **Enable Logging**:
   ```bash
   # Clear existing logs
   adb logcat -c
   
   # Monitor RevenueCat logs
   adb logcat | grep RevenueCat
   ```

2. **Key Log Messages to Look For**:
   - `"Initializing RevenueCat from MainApplication.kt"` - Indicates native initialization started
   - `"Successfully initialized RevenueCat in native code"` - Indicates native initialization succeeded
   - `"Already configured by native module"` - JS code detected native initialization
   - `"Verified with getAppUserID"` - Successful verification of module functionality

3. **Testing Feature Functionality**:
   - Try opening the subscription screen to verify offerings can be fetched
   - If set up for sandbox testing, attempt a test subscription purchase
   - Test restoring purchases if already subscribed

4. **Building for Production**:
   ```bash
   # Clean build for production
   ./scripts/clean-and-build-apk.sh
   ```

### 3. Error Handling

If you encounter issues during testing:

1. **Native Initialization Errors**:
   - Check the Android logcat for exceptions during initialization
   - Common causes: API key format issues, network connectivity problems

2. **JS Integration Issues**:
   - Ensure the debug panel shows `"isInitialized": true` in the RevenueCat status
   - If you see errors like `"isConfigured() returns true but verification failed"`, investigate:
     - React Native bridge issues
     - API key mismatch between native and JS
     - Network connectivity issues

3. **Fallback Options**:
   - If native initialization consistently fails, update the JS initialization to retry multiple times
   - Consider adding a user-initiated "retry connection" button for recovery

## Additional Considerations

- This approach should work with Hermes enabled
- The solution is designed to be compatible with future React Native upgrades
- We maintain the ability to initialize from JS as a fallback
- The strategy doesn't interfere with iOS implementation

## References

- [RevenueCat Android Documentation](https://docs.revenuecat.com/docs/android)
- [React Native Purchases Documentation](https://docs.revenuecat.com/docs/reactnative)
- [Expo + Native Modules Guide](https://docs.expo.dev/bare/native-modules/)
