# RevenueCat Integration Plan

This document outlines a step-by-step plan to fix the RevenueCat integration in the Cora project. The plan follows RevenueCat best practices and addresses the current issues with the implementation.

## Current Issues

1. **Native Module Linking Errors**: 
   - "Purchases module is not available" errors
   - "Cannot read property 'isConfigured' of null" errors
   - UI package import errors

2. **Overcomplicated Implementation**:
   - Custom event emitters
   - Complex retry logic
   - Conditional imports that cause build-time issues

3. **Missing Configuration**:
   - Expo plugin configuration missing
   - Incomplete Gradle configuration

## Implementation Plan

### Phase 1: Configuration Updates

1. **Update app.config.ts**:
   ```typescript
   export default {
     // ... existing config
     plugins: [
       // ... existing plugins
       [
         "react-native-purchases",
         {
           "ios": {
             "appTargetIdentifier": "me.feelheard"
           },
           "android": {
             "gradlePluginVersion": "7.3.1"
           }
         }
       ]
     ]
   };
   ```

2. **Update Android build.gradle**:
   ```gradle
   // In android/app/build.gradle

   dependencies {
     // ... existing dependencies
     
     // RevenueCat dependencies
     implementation 'com.revenuecat.purchases:purchases:8.+'
     implementation 'com.android.billingclient:billing:6.+'
   }
   ```

3. **Update Android repositories**:
   ```gradle
   // In android/build.gradle

   allprojects {
     repositories {
       // ... existing repositories
       
       // RevenueCat repository
       maven { url "https://sdk.revenuecat.com/android" }
     }
   }
   ```

### Phase 2: Simplify JavaScript Implementation

1. **Simplify initialization**:
   Replace the complex `initialize-revenuecat.ts` file with a simpler approach:

   ```typescript
   // utils/subscription/initialize-revenuecat.ts
   import { Platform } from 'react-native';
   import Purchases, { LOG_LEVEL } from 'react-native-purchases';
   import { REVENUE_CAT_API_KEYS } from './config';

   // Track initialization state
   let hasInitialized = false;

   export async function initializeRevenueCat(): Promise<boolean> {
     // Skip web platform
     if (Platform.OS === 'web') {
       console.log('📱 RevenueCat: Web platform detected, skipping initialization');
       return false;
     }
     
     // Skip if already initialized
     if (hasInitialized) {
       console.log('📱 RevenueCat: Already initialized');
       return true;
     }
     
     try {
       // Get API key for platform
       const apiKey = Platform.OS === 'ios' 
         ? REVENUE_CAT_API_KEYS.ios 
         : REVENUE_CAT_API_KEYS.android;
       
       // Configure RevenueCat SDK
       console.log(`📱 RevenueCat: Configuring with ${Platform.OS} API key`);
       Purchases.configure({ apiKey });
       
       // Set debug log level for development
       if (__DEV__) {
         Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
       }
       
       // Try to initialize UI package if available
       try {
         if (Platform.OS !== 'web') {
           const { configure: configureUI } = require('react-native-purchases-ui');
           configureUI();
           console.log('📱 RevenueCat: UI package configured');
         }
       } catch (uiError) {
         console.warn('📱 RevenueCat: UI package configuration failed:', uiError);
         // Non-critical error, continue
       }
       
       // Verify initialization
       await Purchases.getCustomerInfo();
       
       hasInitialized = true;
       console.log('📱 RevenueCat: Initialization successful');
       return true;
     } catch (error) {
       console.error('📱 RevenueCat: Initialization failed:', error);
       
       // Use simulation in development mode on Android
       if (Platform.OS === 'android' && __DEV__) {
         console.log('📱 RevenueCat: Using simulation mode for development');
         hasInitialized = true;
         return true;
       }
       
       return false;
     }
   }

   export function getInitializationStatus(): boolean {
     return hasInitialized;
   }
   ```

2. **Simplify SubscriptionContext.tsx**:
   - Use direct imports rather than dynamic requires
   - Simplify the context provider
   - Remove duplicate error handling
   - Keep simulation for development mode

3. **Update App Root Layout**:
   ```typescript
   // app/_layout.tsx
   import { useEffect } from 'react';
   import { initializeRevenueCat } from '../utils/subscription/initialize-revenuecat';

   export default function RootLayout() {
     // ... existing code
     
     useEffect(() => {
       // Initialize RevenueCat early in the app lifecycle
       const initRevenueCat = async () => {
         try {
           await initializeRevenueCat();
         } catch (error) {
           console.error('RevenueCat initialization error:', error);
         }
       };
       
       initRevenueCat();
     }, []);
     
     // ... existing code
   }
   ```

### Phase 3: Native Rebuild

1. **Clean the project**:
   ```bash
   # From project root
   npm install
   ```

2. **Regenerate native files**:
   ```bash
   npx expo prebuild --clean
   ```

3. **Clean Android build**:
   ```bash
   cd android && ./gradlew clean && cd ..
   ```

4. **Build the app**:
   ```bash
   npm run build:local-apk
   ```

### Phase 4: Testing

1. **Development Testing**:
   - Test running the app in development mode
   - Verify that RevenueCat SDK initializes properly
   - Check subscription page loads
   - Test simulation mode works in development

2. **Production Testing**:
   - Build a release version
   - Test on real Android device
   - Verify subscription page loads
   - Test subscription status retrieval
   - Test purchase flow (in sandbox mode)

## Fallback Plan

If the RevenueCat integration continues to face issues, consider:

1. **Pure Simulation Mode**: Create a complete simulation of subscription features for development without RevenueCat dependency

2. **Alternative Approach**: Consider using Stripe directly or another payment provider

3. **Platform-Specific Code**: Create separate code paths for web (Stripe) and mobile (RevenueCat)

## Maintenance Considerations

1. **Versioning**: Keep RevenueCat SDK versions in sync (react-native-purchases and react-native-purchases-ui)

2. **Upgrade Strategy**: When upgrading RevenueCat, test thoroughly as native dependencies can break

3. **Error Monitoring**: Add proper error logging for RevenueCat operations in production

4. **Documentation**: Keep implementation details documented for future developers

## Timeline

1. **Phase 1 (Configuration)**: 1 day
2. **Phase 2 (JavaScript Implementation)**: 1-2 days
3. **Phase 3 (Native Rebuild)**: 1 day
4. **Phase 4 (Testing)**: 1-2 days

Total estimated time: 4-6 days