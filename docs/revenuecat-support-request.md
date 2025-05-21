# RevenueCat Support Request - Native Module Not Fully Initializing

## Environment Details

- React Native: 0.79.2
- Expo: 53.0.9
- react-native-purchases: 8.10.0
- react-native-purchases-ui: 8.10.0
- Platform: Android (Pixel 6, Android 15)
- Hermes JavaScript Engine: Enabled
- Build Type: Production/Release
- New Architecture: Enabled

## Issue

We're experiencing an issue with the RevenueCat SDK in our React Native Expo application. The SDK is detected but not properly initialized - showing only two methods (`addListener` and `removeListeners`) available on the native module, leading to "RevenueCat SDK not available" errors.

When examining the native module, we see:
```javascript
hasRNPurchasesModule: true,
rnPurchasesDetails: "addListener,removeListeners",
availableNativeModules: []
```

The JavaScript `Purchases` object exists (`purchasesType: "function"`), but attempts to configure it fail because the underlying native functionality is not fully initialized.

## Detailed Logs

```json
// Initial detection of RevenueCat module
{
  "timestamp":"2025-05-18T21:33:26.629Z",
  "platform":"android",
  "environment":"production",
  "hasRNPurchasesModule":true,
  "rnPurchasesDetails":"addListener,removeListeners",
  "availableNativeModules":[],
  "platformDetails":"{\"uiMode\":\"normal\",\"reactNativeVersion\":{\"minor\":79,\"prerelease\":null,\"major\":0,\"patch\":2},\"isTesting\":false,\"Brand\":\"google\",\"Manufacturer\":\"Google\",\"Release\":\"15\",\"Fingerprint\":\"google/oriole/oriole:15/BP1A.250305.019/13003188:user/release-keys\",\"Serial\":\"unknown\",\"Model\":\"Pixel 6\",\"Version\":35}",
  "isHermes":true,
  "purchasesType":"function",
  "purchasesVersion":"unknown"
}

// After attempting to force initialization
{
  "timestamp":"2025-05-18T21:33:29.408Z",
  "platform":"android",
  "environment":"production",
  "purchasesType":"function",
  "purchasesValue":"function Purchases() { [bytecode] }",
  "hasRNPurchasesModule":true,
  "rnPurchasesDetails":"addListener,removeListeners",
  "availableNativeModules":[],
  "platformDetails":"{\"uiMode\":\"normal\",\"reactNativeVersion\":{\"minor\":79,\"prerelease\":null,\"major\":0,\"patch\":2},\"isTesting\":false,\"Brand\":\"google\",\"Manufacturer\":\"Google\",\"Release\":\"15\",\"Fingerprint\":\"google/oriole/oriole:15/BP1A.250305.019/13003188:user/release-keys\",\"Serial\":\"unknown\",\"Model\":\"Pixel 6\",\"Version\":35}",
  "isHermes":true,
  "purchasesVersion":"unknown"
}
```

## Initialization Code

The RevenueCat SDK is initialized in our SubscriptionContext.tsx:

```typescript
// From SubscriptionContext.tsx
Purchases.configure({ apiKey });
console.log("📱 [SubscriptionContext] RevenueCat configured successfully");

// Now set log level AFTER configuration
if (typeof Purchases.setLogLevel === "function") {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
} else {
  console.warn("📱 [SubscriptionContext] RevenueCat setLogLevel method not available");
}
```

## What I've Done So Far

1. **Verified Package Versions**:
   - Updated both `react-native-purchases` and `react-native-purchases-ui` to 8.10.0
   - Confirmed all dependencies are installed and up to date

2. **Android Configuration**:
   - Added Firebase dependencies to `android/app/build.gradle`:
     ```gradle
     implementation platform('com.google.firebase:firebase-bom:32.7.4')
     implementation 'com.google.firebase:firebase-analytics'
     implementation 'com.google.firebase:firebase-messaging'
     ```
   - Confirmed Google Services plugin is properly applied
   - Added ProGuard rules for RevenueCat:
     ```
     -keep class com.revenuecat.purchases.** { *; }
     -keep class com.android.billingclient.** { *; }
     -keepattributes *Annotation*
     ```

3. **Permissions & Configuration**:
   - Added billing permission in app.config.ts:
     ```typescript
     permissions: [
       // ... other permissions
       "com.android.vending.BILLING", // Required for RevenueCat in-app purchases
     ]
     ```
   - Set minSdkVersion to 24 as required by RevenueCat
   - Added Firebase configuration with google-services.json

4. **Debugging Attempts**:
   - Added delays before initialization
   - Implemented forced reload attempts for the native module
   - Added detailed logging via Medplum Communication resources
   - Created in-app debugging panel to view logs
   - Completely cleaned and rebuilt the application

## Observations

- The native `RNPurchases` module is detected but only has two event-related methods
- These methods (addListener, removeListeners) are typically part of the NativeEventEmitter base functionality
- The inconsistency of `hasRNPurchasesModule: true` but `availableNativeModules: []` suggests the module is only partially initialized
- Debug attempts to force-load the module have not resolved the issue
- The same configuration works on iOS devices

## Questions

1. Why is the native module partially initialized with only event methods available?
2. Could this be related to React Native's new architecture mode?
3. Are there specific Expo configuration requirements we're missing?
4. Is there a way to force the complete native module to load properly?
5. Are there additional native dependencies needed beyond Firebase?
6. Could this be related to Hermes JavaScript engine compatibility?

We're using a physical device for testing, not an emulator. Any assistance in resolving this issue would be greatly appreciated.

## Additional Context

- We're using Expo with native code capabilities (not bare workflow)
- The app.config.ts note specifies: "RevenueCat is initialized in code rather than as a plugin because react-native-purchases doesn't support being used as a config plugin"
- The app successfully builds and runs, just without RevenueCat functionality
- We've implemented fallback handling for premium features when RevenueCat is unavailable

Thank you for your help!