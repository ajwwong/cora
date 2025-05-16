# RevenueCat Setup Guide

This document outlines the setup process for RevenueCat in the FeelHeard app.

## Overview

RevenueCat provides subscription and in-app purchase infrastructure for mobile apps. This guide explains how it's integrated in our app and what steps are needed to complete the setup for production.

## Integration

The RevenueCat integration includes:

1. **Core SDK**: `react-native-purchases` for the core subscription functionality
2. **UI Components**: `react-native-purchases-ui` for pre-built UI elements
3. **Native Dependencies**: Android and iOS native libraries

## Installation

The necessary packages have been added to the project:

```json
{
  "dependencies": {
    "react-native-purchases": "^8.9.7",
    "react-native-purchases-ui": "^8.4.0"
  }
}
```

## Android Configuration

### Gradle Setup

The Android build files have been updated to include RevenueCat dependencies:

- Added `purchases-android` and `purchases-ui` to app/build.gradle
- Added RevenueCat SDK repository to android/build.gradle
- Added ProGuard rules for proper minification

### Native Module Registration

The MainApplication.java has been updated to:
- Import RevenueCat packages
- Initialize the SDK with basic setup

## iOS Configuration

For iOS, additional steps are required:

1. Update Podfile to include RevenueCat dependencies
2. Ensure entitlements are set correctly for in-app purchases

## Development vs Production

### Development Mode

For development:

- Simulation mode is automatically enabled on Android development builds
- Debug UI is available when running in development mode
- Debug panel provides tools for testing subscription features

### Production Requirements

To fully enable RevenueCat in production:

1. Set up an account in the [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Configure products in App Store Connect (iOS) and Google Play Console (Android)
3. Update the API keys in `utils/subscription/config.ts`

## JavaScript Implementation

The JavaScript implementation includes:

1. Initialization module in `utils/subscription/initialize-revenuecat.ts`
2. Configuration constants in `utils/subscription/config.ts`
3. Context provider in `contexts/SubscriptionContext.tsx`
4. Debug UI in `components/SubscriptionDebugPanel.tsx`

## Testing

See `docs/android-subscription-testing-guide.md` for detailed testing instructions.