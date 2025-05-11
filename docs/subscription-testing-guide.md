# Subscription Testing Guide for Cora

This guide outlines how to test the subscription functionality in the Cora app.

## Prerequisites

- RevenueCat account with sandbox environment configured
- Apple Developer account (for iOS testing)
- Google Play Console access (for Android testing)
- Test devices or simulators for iOS and Android

## Test Plan Overview

1. Authentication Integration Testing
2. Free Tier Functionality Testing
3. Voice Message Usage Limit Testing
4. Subscription UI/UX Testing
5. Purchase Flow Testing (Sandbox)
6. Restore Purchases Testing
7. Cross-device and Platform Testing

## 1. Authentication Integration Testing

Verify that RevenueCat properly integrates with the Medplum authentication flow:

- [ ] Sign in with a Medplum account, check logs to confirm RevenueCat.logIn is called with correct user ID
- [ ] Sign out, verify RevenueCat.logOut is called and registration is cleared
- [ ] Sign in with a different account, ensure RevenueCat identity is updated

## 2. Free Tier Functionality Testing

Ensure the free tier functions correctly:

- [ ] Verify new users can access all text functionality without a subscription
- [ ] Check daily voice message counter starts at 10 for new users
- [ ] Test text messaging functionality works for free users
- [ ] Confirm the user interface correctly identifies the account as using the free "Text Companion" tier

## 3. Voice Message Usage Limit Testing

Test the enforcement of daily voice message limits for free users:

- [ ] Send 1 voice message and verify the counter decreases to 9
- [ ] Continue sending voice messages until reaching the daily limit of 10
- [ ] Attempt to send an 11th voice message and verify the limit screen appears
- [ ] Check that the "Upgrade to Voice Connect" button navigates to subscription screen
- [ ] Verify the counter resets after 24 hours
- [ ] Check message counter persists even after app restart/relogin

## 4. Subscription UI/UX Testing

Test the subscription interface and user experience:

- [ ] Navigate to subscription screen via settings modal
- [ ] Verify subscription plans display correctly with appropriate pricing
- [ ] Check that current plan is highlighted for free users
- [ ] Test layout and appearance on different screen sizes
- [ ] Verify all buttons and interactive elements are responsive
- [ ] Ensure subscription status is correctly displayed in settings

## 5. Purchase Flow Testing (Sandbox)

Test the purchase flow using RevenueCat sandbox environment:

- [ ] Create test user in RevenueCat dashboard
- [ ] Attempt to purchase monthly subscription in sandbox mode
- [ ] Check purchase confirmation UI displays correctly
- [ ] Verify subscription status updates in app after successful purchase
- [ ] Confirm upgrade success screen appears and closes properly
- [ ] Test that premium features unlock immediately after purchase
- [ ] Verify unlimited voice messaging is available after upgrading

### Using Debugging Tools

The app includes enhanced debugging tools to help with subscription testing:

1. **RevenueCat Debug UI Overlay**:
   - Available on device builds
   - Shows real-time subscription status, customer info, and offerings
   - Automatically enabled in the app

2. **Subscription Debug Panel**:
   - Located at the bottom of the Subscription screen
   - Shows current customer ID and subscription status
   - Provides buttons to refresh customer info, offerings, and the debug UI overlay

3. **Console Logging**:
   - Detailed RevenueCat logs with timestamp and log level
   - Custom log handler formats all RevenueCat logs consistently
   - Helpful for tracking subscription events

## 6. Restore Purchases Testing

Test the restore purchases functionality:

- [ ] Sign in with a user who has previously purchased a subscription
- [ ] Use the "Restore Purchases" button on the subscription screen
- [ ] Verify subscription status is restored correctly
- [ ] Confirm premium features are accessible after restore
- [ ] Test restore purchases on a new device with same account

## 7. Cross-device and Platform Testing

Ensure consistent behavior across platforms:

- [ ] Test subscription flow on iOS devices/simulators
- [ ] Test subscription flow on Android devices/emulators
- [ ] Verify subscription status syncs between devices with same account
- [ ] Test subscription restoration when moving from one platform to another
- [ ] Confirm UI adaptive designs work properly on different screen sizes

## Test Data Setup

### RevenueCat Sandbox Test User Setup

1. Create test users in the RevenueCat dashboard
2. Configure sandbox testing mode in RevenueCat
3. Set up test subscription products with both monthly and annual options

### Test Account Scenarios

1. **New User (Free Tier)**
   - No previous subscription history
   - 10 daily voice messages available

2. **Premium User**
   - Active Voice Connect subscription
   - Unlimited voice messaging

3. **Expired Subscription User**
   - Previously had Voice Connect subscription
   - Now reverted to free tier limitations

## Important Test Cases

- [ ] **Voice Message Limit Enforcement**: Verify a free user cannot send more than 10 voice messages in a 24-hour period
- [ ] **Subscription Purchase Flow**: Test complete end-to-end purchase flow in sandbox environment
- [ ] **Authentication Integration**: Ensure RevenueCat user ID correctly syncs with Medplum user ID
- [ ] **Premium Feature Access**: Verify unlimited voice messaging works for premium subscribers
- [ ] **Subscription Management**: Test managing subscription status from settings
- [ ] **Visual Indicators**: Check that all subscription status indicators update appropriately

## RevenueCat Dashboard Verification

After performing test purchases, verify in the RevenueCat dashboard:

1. User appears with correct subscription status
2. Purchase events are properly recorded
3. Entitlements are correctly assigned to test users

## Error Handling Testing

Test common error scenarios:

- [ ] Network disconnection during purchase flow
- [ ] User cancellation during purchase
- [ ] Failed payment in sandbox mode
- [ ] Restore purchases with no previous purchases
- [ ] Multiple rapid subscription change attempts

## Debugging Guide

### Accessing RevenueCat Logs

1. Connect your device to a computer and use:
   - Xcode Console for iOS devices
   - Logcat for Android devices
   - Look for logs with "[RevenueCat]" prefix

2. Use the custom debug panel:
   - Go to the Subscription screen to view the debug panel
   - Use the "Refresh Customer Info" button to force a refresh of customer data
   - Use the "Refresh Offerings" button to force a refresh of available packages
   - Use the "Refresh Debug UI Overlay" if the floating UI becomes stale

3. Debug UI Overlay:
   - A floating window shows real-time subscription data
   - Tap on different sections to expand/collapse information
   - Shows customer ID, entitlements, offerings and more

### Troubleshooting Common Issues

1. **Subscription Not Recognized:**
   - Use "Refresh Customer Info" in the debug panel
   - Check the Debug UI Overlay for current entitlements
   - Verify the customer ID matches between app and RevenueCat dashboard

2. **Offerings Not Showing:**
   - Use "Refresh Offerings" in the debug panel
   - Check RevenueCat dashboard to ensure offerings are configured correctly
   - Look for network errors in the logs

3. **Purchase Failures:**
   - Check for detailed error messages in the console logs
   - Verify sandbox environment is properly configured
   - Make sure you're using sandbox test accounts for Store testing