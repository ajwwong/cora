# RevenueCat Android Integration Support Request

## Environment Details

- **App Name**: FeelHeard
- **Bundle ID**: me.feelheard
- **Platform**: Android
- **Device**: Pixel 6, API 35 (Android 15)
- **RevenueCat SDK Version**: react-native-purchases v8.10.0
- **React Native Version**: 0.79.2
- **Expo Version**: 53.0.9
- **Hermes Enabled**: Yes
- **New Architecture**: Disabled (set to false in app.config.ts)
- **Build Process**: Production release APK built via Expo prebuild + Gradle
- **Installation Method**: Direct APK transfer via USB to device

## Current Issue

We're experiencing a persistent issue with the RevenueCat SDK initialization on Android. The JavaScript module imports correctly, but it cannot communicate with the native module. This results in failures when trying to call any RevenueCat methods with the error:

```
There is no singleton instance. Make sure you configure Purchases before trying to get the default instance. More info here: https://errors.rev.cat/configuring-sdk
```

## Diagnostic Information

Our diagnostic logs show the following key issues:

1. **JavaScript vs Native Module Mismatch**:
   - `purchasesType: "function"` but the methods are not accessible
   - `hasRNPurchasesModule: true` but `availableNativeModules: []`
   - Error when trying to call methods: `setup method not available on RNPurchases`

2. **Native Module Status**:
   - The native module RNPurchases exists (`hasRNPurchases: true`)
   - It has methods listed (addListener, canMakePayments, etc.)
   - But when we try a direct call, we get "setup method not available on RNPurchases"

3. **Initialization Flow**:
   - We initialize RevenueCat in our `initialize-revenue-cat.ts` file
   - We call `Purchases.configure({ apiKey })` with the correct API key
   - We set log level to verbose in development with `Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE)`
   - We have comprehensive checks and logging after configuration

## Expo Setup and Workflow

We're using Expo in a specific configuration that may be relevant to our RevenueCat integration issues:

1. **Expo Workflow**:
   - Using Expo SDK 53.0.9
   - Using a **prebuild workflow** (not pure managed or bare)
   - We run `npx expo prebuild --clean` to generate native projects before building
   - Not using Expo Go for testing, but building standalone APKs

2. **Build Process**:
   - Local builds only (not using EAS Build services)
   - Direct Gradle command execution after prebuild
   - Custom shell scripts for building (clean-and-build-apk.sh)
   - Direct installation to device via USB (not through app stores)

3. **Native Module Handling**:
   - React Native autolinking for most modules
   - Expo plugins system for configuration (expo-build-properties)
   - No manual linking in native code (except our MainApplication.kt fix attempt)
   - No direct expo-dev-client usage for testing

This hybrid approach (Expo config + direct native builds) may be affecting how the RevenueCat native module initializes.

## Project Configuration

1. **App.config.ts**:
   - We have the necessary Android permissions: `com.android.vending.BILLING`
   - We've set `minSdkVersion: 24` as required by RevenueCat
   - We've disabled New Architecture temporarily for testing: `newArchEnabled: false`
   
   ```typescript
   // Excerpt from app.config.ts
   export default ({ config }: ConfigContext): ExpoConfig => ({
     ...config,
     name: "FeelHeard",
     slug: "feelheard-me",
     version: "1.0.0",
     // ...
     newArchEnabled: false, // Temporarily disabled to test RevenueCat compatibility
     jsEngine: "hermes",
     platforms: ["android", "ios", "web"],
     // ...
     android: {
       adaptiveIcon: {
         foregroundImage: "./assets/images/adaptive-icon.png",
         backgroundColor: "#ffffff",
       },
       permissions: [
         "android.permission.RECORD_AUDIO",
         "android.permission.RECEIVE_BOOT_COMPLETED",
         "android.permission.SCHEDULE_EXACT_ALARM",
         "android.permission.POST_NOTIFICATIONS",
         "android.permission.USE_FULL_SCREEN_INTENT",
         "com.android.vending.BILLING", // Required for RevenueCat in-app purchases
       ],
       package: "me.feelheard",
       googleServicesFile: "./google-services.json",
       edgeToEdgeEnabled: true,
     },
     // ...
     plugins: [
       // ...
       // Add build properties plugin for RevenueCat compatibility
       [
         "expo-build-properties",
         {
           android: {
             minSdkVersion: 24, // Required by RevenueCat
           },
         },
       ],
       // RevenueCat is initialized in code rather than as a plugin
       // because react-native-purchases doesn't support being used as a config plugin
     ],
   });
   ```

2. **Android Configuration**:
   - Our Android app build.gradle includes the Google services plugin
   - We have autolinked dependencies with `autolinkLibrariesWithApp()`
   - We have Hermes enabled through the standard configuration
   
   ```gradle
   // Excerpt from android/app/build.gradle
   apply plugin: "com.android.application"
   apply plugin: "org.jetbrains.kotlin.android"
   apply plugin: "com.facebook.react"
   
   // ...
   
   react {
     // ...
     /* Autolinking */
     autolinkLibrariesWithApp()
   }
   
   // ...
   
   android {
     ndkVersion rootProject.ext.ndkVersion
     buildToolsVersion rootProject.ext.buildToolsVersion
     compileSdk rootProject.ext.compileSdkVersion
   
     namespace 'me.feelheard'
     defaultConfig {
       applicationId 'me.feelheard'
       minSdkVersion rootProject.ext.minSdkVersion
       targetSdkVersion rootProject.ext.targetSdkVersion
       versionCode 1
       versionName "1.0.0"
     }
     // ...
   }
   
   dependencies {
     // The version of react-native is set by the React Native Gradle Plugin
     implementation("com.facebook.react:react-android")
     
     // ...
     
     if (hermesEnabled.toBoolean()) {
       implementation("com.facebook.react:hermes-android")
     } else {
       implementation jscFlavor
     }
   }
   
   apply plugin: 'com.google.gms.google-services'
   ```
   
   ```gradle
   // Excerpt from android/build.gradle
   buildscript {
     repositories {
       google()
       mavenCentral()
     }
     dependencies {
       classpath 'com.google.gms:google-services:4.4.1'
       classpath('com.android.tools.build:gradle')
       classpath('com.facebook.react:react-native-gradle-plugin')
       classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
     }
   }
   
   // ...
   
   allprojects {
     repositories {
       maven {
         // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm
         url(reactNativeAndroidDir)
       }
   
       google()
       mavenCentral()
       maven { url 'https://www.jitpack.io' }
     }
   }
   ```

3. **Build Process**:
   - We use a custom `clean-and-build-apk.sh` script for consistent builds
   - The script runs `npx expo prebuild --clean` to prepare native projects
   - It then runs `./gradlew clean` followed by `./gradlew assembleRelease` with optimized settings
   - We pass `-PrevenueCatDebug=true` to enable additional RevenueCat debugging
   - The resulting APK is transferred via USB to the Pixel device for testing
   - We've also attempted creating AABs for Google Play closed testing with the same initialization issues

4. **JavaScript Implementation**:
   - We import RevenueCat properly: `import Purchases from 'react-native-purchases'`
   - We have a dedicated initialization utility in `utils/subscription/initialize-revenue-cat.ts`
   - We use the correct API keys from our configuration file

## Initialization Implementation

Here's our current RevenueCat initialization code:

```typescript
// From initialize-revenue-cat.ts

// Get the appropriate API key for the platform
const apiKey = Platform.OS === 'ios' ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;

// Display which API key we're using (hiding most of it)
const apiKeyPrefix = apiKey.substring(0, 6);
const apiKeySuffix = apiKey.substring(apiKey.length - 4);
showVisibleMessage('RevenueCat', `Configuring with ${apiKeyPrefix}...${apiKeySuffix}`);

// Set verbose logging in development BEFORE configuration
if (__DEV__ && typeof Purchases.setLogLevel === 'function') {
  Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
}

// Configure RevenueCat
Purchases.configure({ apiKey });
```

When this runs, we observe the following in the logs:

```
SDK Type: function
Methods: none
Configure available: false
isConfigured available: false
```

This indicates the JavaScript interface is present but empty and can't call native methods.

## Attempted Solutions

1. We've implemented extensive debugging and logging:
   - Created a debug panel to show the status of the RevenueCat SDK
   - Added detailed logging of all RevenueCat operations to Communication resources
   - Added a diagnostics function that shows detailed information about the SDK state

2. We've tried these approaches:
   - Setting log level before calling configure
   - Adding a delay before initialization
   - Adding retry mechanisms for configuration
   - Clean rebuilding the app

3. We've identified that the most likely root cause is a React Native bridge initialization issue where:
   - The JavaScript interface loads fine
   - The native module is registered but not fully initialized
   - Method calls can't cross the bridge properly

## Our Current Strategy

Based on our analysis, we're implementing a two-pronged approach:

1. **Native-side initialization**: Manually initializing RevenueCat in MainApplication.kt's `onCreate()` method before the React Native bridge loads:

```kotlin
// Initialize RevenueCat early to ensure native module is ready
try {
  // Set log level to verbose for debugging
  Purchases.logLevel = LogLevel.VERBOSE
  
  // Configure RevenueCat with API key
  val revenueCatApiKey = "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo" // Google Play key from config.ts
  val configuration = PurchasesConfiguration.Builder(this, revenueCatApiKey).build()
  Purchases.configure(configuration)
  
  Log.d("RevenueCat", "Successfully initialized RevenueCat in MainApplication.kt")
} catch (e: Exception) {
  Log.e("RevenueCat", "Failed to initialize RevenueCat in MainApplication.kt", e)
}
```

2. **JavaScript-side awareness**: Making our JS code check if RevenueCat was already configured by the native side:

```typescript
try {
  // Check if already configured by the native module
  if (typeof Purchases.isConfigured === 'function' && Purchases.isConfigured()) {
    showVisibleMessage('RevenueCat', 'Already configured by native module, skipping JS configuration');
    
    await logToCommunication(medplum, 'RevenueCat already configured by native module', {
      platform: Platform.OS,
      environment: __DEV__ ? 'development' : 'production'
    });
  } else {
    // Configure RevenueCat from JS only if not already configured
    Purchases.configure({ apiKey });
  }
} catch (configError) {
  // If checking isConfigured fails, try to configure anyway
  showVisibleMessage('RevenueCat', `Error checking configuration status: ${configError}, attempting to configure anyway`);
  
  try {
    Purchases.configure({ apiKey });
  } catch (secondConfigError) {
    showVisibleMessage('RevenueCat Error', `JS configuration failed: ${secondConfigError}`, true);
    
    await logToCommunication(medplum, 'RevenueCat JS configuration failed', {
      platform: Platform.OS,
      environment: __DEV__ ? 'development' : 'production',
      error: secondConfigError instanceof Error ? secondConfigError.message : String(secondConfigError)
    });
  }
}
```

The goal is to ensure the native SDK is fully initialized before any JS calls attempt to use it, while maintaining fallback mechanisms for backward compatibility.

## Questions

1. Is our approach of initializing RevenueCat in MainApplication.kt the best solution? Are there any potential issues with this approach?

2. Are there any specific configuration settings or manifest entries we might be missing for proper native module registration?

3. Could the issue be related to the Expo managed workflow or configs? Are there any specific considerations for Expo apps?

4. Is there any way to ensure proper bridge communication without manually initializing on the native side?

5. Do you have any recommendations specific to our environment (React Native 0.79.2, Expo 53, Hermes enabled)?

## Package.json Configuration

Our package.json shows we're using these specific RevenueCat-related dependencies:

```json
{
  "dependencies": {
    // ...
    "react-native": "0.79.2",
    "react-native-purchases": "^8.10.0",
    "react-native-purchases-ui": "^8.10.0",
    // ...
  }
}
```

## Additional Relevant Code

### RevenueCat Debug Panel

We've created a debug panel component that shows detailed native module status:

```typescript
// Excerpt from RevenueCatStatusPanel.tsx
const nativeModuleCheck = async () => {
  try {
    const hasRNPurchases = !!NativeModules.RNPurchases;
    const methods = hasRNPurchases ? Object.keys(NativeModules.RNPurchases) : [];
    
    setNativeInfo({
      hasRNPurchases,
      methods,
      platform: Platform.OS
    });
    
    // Create log entry
    await logToCommunication(
      medplum,
      'PANEL: Native Module Call Attempt',
      {
        hasRNPurchases,
        methods,
        platform: Platform.OS
      }
    );
    
    // Try to call a method directly on the native module
    try {
      if (hasRNPurchases && NativeModules.RNPurchases.setup) {
        await NativeModules.RNPurchases.setup();
        setMethodResult('Setup method call successful');
      } else {
        const availableMethods = methods.join(',');
        throw new Error(`setup method not available on RNPurchases`);
      }
    } catch (err) {
      setMethodResult(String(err));
      
      // Log the error
      await logToCommunication(
        medplum,
        'PANEL: Native Method Error',
        {
          error: String(err),
          availableMethods: methods
        }
      );
    }
  } catch (e) {
    setNativeInfo({
      error: String(e),
      platform: Platform.OS
    });
  }
};
```

### Subscription Context

Our subscription context initializes RevenueCat early in the app lifecycle:

```typescript
// Excerpt from SubscriptionContext.tsx
useEffect(() => {
  const initSubscriptions = async () => {
    try {
      // Initialize RevenueCat
      const success = await initializeRevenueCat(medplum);
      
      if (success) {
        // If initialized successfully, sync with backend
        await syncSubscriptionStatus();
      } else {
        // Fall back to free tier if initialization fails
        setStatus('free');
      }
    } catch (error) {
      console.error('Failed to initialize subscriptions:', error);
      setStatus('free');
    }
  };
  
  initSubscriptions();
}, [medplum]);
```

### Native Module Debugging

The key part of our native module debugging that helped identify the issue:

```typescript
// Check the actual native module details via React Native's NativeModules
const nativeDebugInfo = () => {
  try {
    return {
      hasRNPurchasesModule: !!NativeModules.RNPurchases,
      rnPurchasesDetails: NativeModules.RNPurchases ? Object.keys(NativeModules.RNPurchases).join(',') : 'not found',
      availableNativeModules: Object.keys(NativeModules),
      platformDetails: JSON.stringify(Platform.constants),
      isHermes: typeof HermesInternal !== 'undefined'
    };
  } catch (e) {
    return { error: String(e) };
  }
};
```

## Files Shared

The additional files can be found on github at github.com/ajwwong/cora :
- MainApplication.kt
- app.config.ts
- initialize-revenue-cat.ts
- Android build.gradle files
- RevenueCatStatusPanel.tsx (debug component)
- SubscriptionContext.tsx (initialization flow)


We appreciate any assistance you can provide to help resolve this integration issue.