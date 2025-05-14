# RevenueCat Android Integration Fix Implementation

## Background

The Cora Android app currently experiences an initialization error with RevenueCat:

```
ERROR 📱 [SubscriptionContext] RevenueCat initialization error: [TypeError: Cannot read property 'setLogHandler' of null]
```

This document outlines the comprehensive solution to fix this issue while maintaining the app's functionality.

## Root Cause Analysis

The error occurs because:

1. **Native Module Initialization Timing**: RevenueCat's native module isn't fully initialized when JavaScript code attempts to access methods on it.
2. **Incorrect Initialization Sequence**: The current implementation attempts to set loggers before configuration.
3. **Missing Android Configuration**: Required dependencies might not be properly specified in the Android project.
4. **Expo Development Environment**: The error is specifically happening in the Android build of an Expo-managed app.

## Implementation Plan

### 1. Update SubscriptionContext Implementation

Modify `/cora/contexts/SubscriptionContext.tsx` with the following changes:

```typescript
useEffect(() => {
  const initializePurchases = async () => {
    try {
      setIsLoading(true);

      // For web platform, skip RevenueCat initialization completely
      if (Platform.OS === "web") {
        console.log("📱 [SubscriptionContext] Web platform detected, skipping RevenueCat");
        setIsPremium(true);
        setIsLoading(false);
        return;
      }

      // CRUCIAL: Add a delay to ensure native modules are properly initialized
      // This helps prevent the "setLogHandler of null" error
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the appropriate API key for the platform
      const apiKey =
        Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;

      console.log(`📱 [SubscriptionContext] Initializing RevenueCat for ${Platform.OS}`);

      // Handle case where RevenueCat is not available at all
      if (typeof Purchases !== 'object' || Purchases === null) {
        console.warn("📱 [SubscriptionContext] RevenueCat SDK is not available");
        setIsPremium(true); // Default to premium if SDK not available
        setIsLoading(false);
        return;
      }

      // IMPORTANT: Configure first, then set log handlers
      // This is the reverse of the current implementation
      if (typeof Purchases.configure === "function") {
        Purchases.configure({ apiKey });
        console.log("📱 [SubscriptionContext] RevenueCat configured successfully");
        
        // Now set log level AFTER configuration
        if (typeof Purchases.setLogLevel === "function") {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }
        
        // Now set log handler AFTER configuration
        if (typeof Purchases.setLogHandler === "function") {
          Purchases.setLogHandler((logLevel, message) => {
            // Existing log handler code unchanged
            const levels = {
              [LOG_LEVEL.VERBOSE]: "VERBOSE",
              [LOG_LEVEL.DEBUG]: "DEBUG",
              [LOG_LEVEL.INFO]: "INFO",
              [LOG_LEVEL.WARN]: "WARN",
              [LOG_LEVEL.ERROR]: "ERROR",
            };

            // Format log message with timestamp, level, and message
            const formattedLevel = levels[logLevel] || "UNKNOWN";
            const timestamp = new Date().toISOString();
            const formattedMessage = `[${timestamp}] [RevenueCat][${formattedLevel}] ${message}`;

            // Log to console with appropriate level
            switch (logLevel) {
              case LOG_LEVEL.ERROR:
                console.error(formattedMessage);
                break;
              case LOG_LEVEL.WARN:
                console.warn(formattedMessage);
                break;
              default:
                console.log(formattedMessage);
            }
          });
        }
      } else {
        console.warn("📱 [SubscriptionContext] RevenueCat configure method not available");
        setIsPremium(true);
      }

      // Continue with the rest of the implementation as before
      // ...
    } catch (error) {
      console.error("📱 [SubscriptionContext] RevenueCat initialization error:", error);
      setIsPremium(true); // Default to premium if error
    } finally {
      setIsLoading(false);
    }
  };

  // Increase the delay before initialization to allow native modules to load
  const timer = setTimeout(() => {
    initializePurchases();
  }, 2000); // Changed from 100ms to 2000ms

  // Rest of the implementation remains the same
  // ...
});
```

### 2. Add Safe Execution Helper Method

Add a utility method to safely execute RevenueCat methods with proper error handling:

```typescript
// Add this to SubscriptionContext.tsx
const safelyExecuteRevenueCatMethod = async <T>(
  methodName: string,
  method: () => Promise<T>,
  fallbackValue: T
): Promise<T> => {
  if (Platform.OS === "web") {
    console.log(`📱 [SubscriptionContext] Web platform detected, skipping ${methodName}`);
    return fallbackValue;
  }
  
  try {
    if (typeof method !== "function") {
      console.warn(`📱 [SubscriptionContext] RevenueCat ${methodName} not available`);
      return fallbackValue;
    }
    
    return await method();
  } catch (error) {
    console.error(`📱 [SubscriptionContext] Error executing ${methodName}:`, error);
    return fallbackValue;
  }
};

// Usage examples:
// For getOfferings:
const offerings = await safelyExecuteRevenueCatMethod(
  "getOfferings",
  () => Purchases.getOfferings(),
  { current: null }
);

// For getCustomerInfo:
const customerInfo = await safelyExecuteRevenueCatMethod(
  "getCustomerInfo",
  () => Purchases.getCustomerInfo(),
  null
);
```

### 3. Add Required Expo Configuration

Create or update `app.config.js` (at the project root) to add the necessary build configuration:

```javascript
// app.config.js
export default {
  expo: {
    // ... existing config
    plugins: [
      // ... existing plugins
      
      // Add build properties plugin for proper SDK version
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24, // Required by RevenueCat
          }
        },
      ],
    ],
  },
};
```

### 4. Android Build Configuration

The `android/app/build.gradle` file already contains the necessary configuration. The `versionCode` has been updated to 15, which indicates active maintenance of the Android configuration.

The current build.gradle file has:
- Proper application ID: `me.feelheard`
- Correct signing configurations for both debug and release builds
- Google Services plugin applied
- Proper dependency management

No additional gradle changes are required, which simplifies the implementation process.

### 5. Development Testing Process

To properly test the RevenueCat integration:

1. Install the required build properties package:
   ```bash
   npx expo install expo-build-properties
   ```

2. Create a development build with EAS:
   ```bash
   eas build --profile development --platform android
   ```

3. Once the build completes, install it on a physical Android device (not an emulator).

4. Run with development client:
   ```bash
   npx expo start --dev-client
   ```

5. Monitor logs to verify successful RevenueCat initialization.

## Implementation Steps

1. **Code Updates**:
   - Modify SubscriptionContext.tsx with the new initialization sequence
   - Add the safelyExecuteRevenueCatMethod utility function
   - Update method calls throughout the component to use the safe execution helper

2. **Configuration Updates**:
   - Create/update app.config.js with the build properties plugin
   - No additional changes to android/app/build.gradle are needed

3. **Testing**:
   - Create a development build
   - Test on physical Android devices
   - Verify logs show successful initialization
   - Verify purchases work correctly

## Fallback Behavior

The implementation ensures graceful degradation:

- On web platform, RevenueCat is skipped entirely
- If RevenueCat isn't available, users get premium features by default during development
- All RevenueCat method calls are wrapped in try/catch blocks
- Error handling provides detailed logs for debugging

## Future Considerations

1. **RevenueCat Version Updates**: When updating react-native-purchases, review the API changes to ensure compatibility.

2. **Environment-Specific Behavior**: Consider implementing different premium-access rules for development vs. production.

3. **Retry Mechanisms**: For network-related errors, consider implementing retry logic with exponential backoff.

4. **Analytics**: Add analytics to track initialization failures for better monitoring.

## References

- [RevenueCat React Native SDK Documentation](https://docs.revenuecat.com/docs/reactnative)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [React Native In-App Purchases Guide](https://reactnative.dev/docs/in-app-purchases)