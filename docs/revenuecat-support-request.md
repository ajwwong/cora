# RevenueCat Support Request - Android Native Module Not Available in Development

## Environment Details

- React Native: 0.79.2
- react-native-purchases: 8.9.7
- react-native-purchases-ui: 8.4.0
- Platform: Android
- Development Mode: Yes (Expo)
- Build Type: Debug

## Issue

I'm experiencing an issue with the RevenueCat SDK in my React Native app on Android. During development, the native module is not being properly detected, resulting in the error:

```
LOG  📱 [RevenueCat] RevenueCat module check: RNPurchases=false, RCTPurchases=false
LOG  📱 [RevenueCat] Purchases object is not available
LOG  📱 [RevenueCat] RevenueCat native modules not found in NativeModules
```

When attempting to initialize the SDK, I get the following error:

```
WARN  📱 [RevenueCat] Configure failed but continuing with simulation: [TypeError: Cannot read property 'setupPurchases' of null]
```

And when trying to use the SDK's methods:

```
ERROR  📱 [SubscriptionContext] Error executing getOfferings: [TypeError: Cannot read property 'isConfigured' of null]
ERROR  📱 [SubscriptionContext] Error executing getCustomerInfo: [TypeError: Cannot read property 'isConfigured' of null]
```

## What I've Done So Far

I've implemented the following to try and address this:

1. **Package Installation**:
   - Added `react-native-purchases` and `react-native-purchases-ui` in package.json
   - Confirmed the packages are properly installed in node_modules

2. **Android Configuration**:
   - Added RevenueCat dependencies to `android/app/build.gradle`:
     ```gradle
     implementation 'com.revenuecat.purchases:purchases-android:6.+'
     implementation 'com.revenuecat.purchases:purchases:6.+'
     implementation 'com.revenuecat.purchases-ui:purchases-ui:8.+'
     implementation 'com.android.billingclient:billing:6.+'
     ```

   - Added Maven repository to `android/build.gradle`:
     ```gradle
     maven { url "https://sdk.revenuecat.com/android" }
     ```

   - Created a `MainApplication.java` with proper RevenueCat imports
   
3. **SDK Initialization**:
   - Created a dedicated initialization module
   - Added extensive error handling and fallback simulation for development
   - Implemented NativeEventEmitter handling for error cases
   - Created fallback mock data for testing purposes

4. **Debug Utilities**:
   - Added debug panel and visual indicators for simulated mode
   - Implemented robust error handling throughout the codebase

## Current Workaround

I've implemented a simulation mode for development that allows testing of subscription features without a working RevenueCat SDK. This includes:

- Simulated products and customer info
- Visual indicators for simulated mode
- Debug panel with error handling

While this allows development to continue, I need to properly integrate RevenueCat for production builds.

## Questions

1. Why is the native module not being detected despite being properly installed? 
   - Is there a specific initialization order requirement I'm missing?
   - Are there additional steps needed beyond `autolinkLibrariesWithApp()`?

2. Is there a way to debug the native module loading process more deeply?
   - How can I verify if the native module is being properly linked?

3. Are there specific configuration requirements for Expo-based projects?
   - My project uses Expo but with a custom native code setup

4. Is there any way to test with RevenueCat in development mode on Android emulators?
   - Can I create a sandbox testing environment?

## Additional Context

- I'm using Expo (with native code capabilities)
- The app has a hybrid build process using both Expo and custom native modifications
- I'm targeting Android 7.0+ devices
- The app already has Google Play Services integrated for other features

Thank you for your help! I appreciate any insights into properly integrating RevenueCat in my development environment.