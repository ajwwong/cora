# Android Subscription Testing Guide

This guide outlines the steps for testing RevenueCat subscription features on Android devices and emulators, with particular focus on handling development environments where RevenueCat initialization may fail.

## Background

The RevenueCat SDK integration provides in-app purchase functionality for our application. On Android devices, especially in development environments, the SDK may fail to initialize properly due to:

1. Missing Google Play services
2. Lack of required native modules
3. Emulator limitations
4. Development builds without proper signing

Our implementation includes robust fallback mechanisms for development testing, which this document explains how to use effectively.

## Testing Prerequisites

Before testing, ensure you have:

- An Android device or emulator running Android 7.0+
- Our app installed via debug APK or development build
- Debug tools enabled in the application

## Development Mode Simulation

In development builds (`__DEV__ === true`), our subscription implementation provides a simulation mode that allows testing subscription features even when RevenueCat fails to initialize:

- Premium features are enabled by default
- Subscription packages are simulated
- Customer information is mocked
- Purchase and restore flows can be tested

### Visual Indicators

The app includes several visual indicators to help identify when simulation mode is active:

1. **"SIMULATED" badges** appear next to subscription packages and status indicators
2. **"DEV" badges** appear next to active subscriptions 
3. In the SubscriptionDebugPanel, an expanded status section shows:
   - SDK initialization status
   - Error information if available
   - Explicit indication when running in simulation mode

## Testing Scenarios

### Scenario 1: Fresh Installation Testing

1. Install a development build on your Android device/emulator
2. Navigate to the subscription screen
3. **Expected behavior**: 
   - Visual indicators should show simulation mode is active
   - Subscription packages should appear (simulated)
   - Debug panel should display simulation status
   - Premium features should be enabled despite no actual subscription

### Scenario 2: RevenueCat API Testing

For devices with Google Play services where RevenueCat might initialize:

1. Use the debug panel's "Refresh Customer Info" button
2. Use the debug panel's "Refresh Offerings" button
3. **Expected behavior**:
   - Console logs should show the initialization attempts
   - If initialization succeeds, real RevenueCat data should load
   - If initialization fails, app should fall back to simulation

### Scenario 3: UI/UX Testing

To ensure the UI works properly:

1. Test the purchase flow by tapping "Subscribe" on a package
2. Test the "Restore Purchases" button
3. Navigate between the subscription screen and other parts of the app
4. **Expected behavior**:
   - Simulated purchase flow should work without errors
   - UI should render consistently with simulation indicators
   - App should not crash during any subscription operations

## Debugging

### Debug Panel

The SubscriptionDebugPanel provides several tools to diagnose and debug subscription issues:

- **Refresh Customer Info**: Attempts to fetch the latest customer data
- **Refresh Offerings**: Attempts to fetch the latest subscription packages
- **Refresh Debug UI**: Toggles the RevenueCat debug overlay (if available)

Each button has been enhanced with error handling and will display status messages if operations fail.

### Console Logs

All subscription operations include extensive console logging with a 📱 emoji prefix:

- `📱 [RevenueCat]`: General RevenueCat initialization logs
- `📱 [SubscriptionContext]`: Context operations and state changes 
- `📱 [SubscriptionContext] Debug:`: Debug panel operation logs

### Common Issues and Solutions

#### Issue: "Purchases module is not available" Error

This occurs when the RevenueCat native module cannot be found. For development testing:

- The app automatically falls back to simulation mode
- Premium features are enabled automatically
- No action is needed for development testing

For production testing, ensure:
- The app was built with `react-native-purchases` properly linked
- The device has Google Play services installed
- The app is signed with the correct keystore

#### Issue: No Packages Displayed

If subscription packages don't appear:

1. Use "Refresh Offerings" in the debug panel
2. Check console logs for specific errors
3. Force close and restart the app

The app should fall back to simulated packages if real ones cannot be loaded.

## Production vs. Development

Note that simulation mode is ONLY active when:
1. The app is running in development mode (`__DEV__ === true`)
2. The device platform is Android (`Platform.OS === 'android'`)

In production builds, the normal RevenueCat initialization flow is used without simulation.

## Testing Checklist

- [ ] Verify simulation mode visual indicators appear appropriately
- [ ] Verify subscription screen loads without errors
- [ ] Test the purchase flow with simulation
- [ ] Test the restore purchases flow
- [ ] Verify premium features work when in simulation mode
- [ ] Check for any console errors or warnings
- [ ] Test app on both emulator and physical device if possible

## Additional Resources

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [RevenueCat React Native SDK](https://docs.revenuecat.com/docs/reactnative)
- [Google Play Billing Library](https://developer.android.com/google/play/billing)