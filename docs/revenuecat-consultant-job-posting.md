# RevenueCat Integration Specialist for Expo React Native App

## Project Overview:
We're developing a React Native health application using Expo and need assistance implementing RevenueCat for in-app subscriptions. The app already has the RevenueCat SDK installed, and we have basic code structure in place, but we're experiencing issues with initialization and proper integration, particularly on Android.

## Current Setup:
- **App Framework**: React Native with Expo (v53)
- **Development Environment**: React Native app compiled for both iOS and Android
- **RevenueCat SDK**: react-native-purchases v8.10.0 and react-native-purchases-ui v8.10.0 already installed
- **Subscription Context**: Implemented but experiencing initialization issues
- **RevenueCat Account**: Already set up with products defined in RevenueCat dashboard
- **App Store/Google Play**: Products configured in both app stores

## Requirements:

### 1. Fix RevenueCat Initialization Issues
- Resolve initialization issues in our current implementation, particularly on Android
- Ensure proper RevenueCat SDK configuration for both iOS and Android platforms
- Implement resilient error handling for scenarios when RevenueCat SDK fails to initialize
- Ensure the SDK correctly connects to our RevenueCat account (app3e20afa061)

### 2. Complete Subscription Flow Implementation
- Implement a clean, user-friendly subscription purchase flow
- Ensure that purchase confirmation and transaction processing work correctly
- Implement restoration of purchases for returning users
- Implement proper transaction receipt validation

### 3. Feature-Gating Implementation
- We have a free tier with limited voice messages (10 per day) that needs proper tracking and enforcement
- Premium subscription (Voice Connect) should unlock unlimited voice messaging
- Implement a clean, non-intrusive upgrade prompt when free tier limits are reached

### 4. Testing and Debugging
- Provide guidance on sandbox testing for both platforms
- Implement comprehensive testing for various subscription scenarios
- Set up proper logging for troubleshooting subscription issues
- Create developer tools for simulating subscription states during development

### 5. Cross-Platform Compatibility
- Ensure consistent behavior across iOS and Android
- Implement web-based fallback strategies when RevenueCat is not available (web platform support)
- Make sure React Native WebView contexts correctly handle subscription status

## Existing Code Structure:
- We have already implemented `SubscriptionContext.tsx` with most of the RevenueCat integration code
- `SubscriptionDebugPanel.tsx` is implemented for development testing
- Configuration exists in `utils/subscription/config.ts` with API keys
- We have documentation in place, including integration plans and testing guides

## Schedule and Availability:
- This is a high-priority task that requires timely completion
- We prefer someone who can complete the task within 1-2 weeks
- Please be available for regular communication during the implementation phase
- Need to be available for at least 2 follow-up sessions after initial implementation

## Skills Required:
- Strong experience with RevenueCat SDK and in-app purchases in React Native
- Experience with Expo development and build process
- Familiarity with App Store and Google Play subscription products
- Experience with TypeScript and React Context API
- Strong debugging skills, particularly for native module integration issues

## Deliverables:
1. Fully functional RevenueCat integration with proper initialization
2. Complete documentation of the implementation, including testing instructions
3. Any necessary updates to our existing code to ensure proper functionality
4. Instructions for deployment considerations when moving to production

## Budget:
- Please provide your hourly rate
- We estimate this will require approximately 10-20 hours of work

## How to Apply:
1. Share your past experience with RevenueCat implementations
2. Provide examples of similar work you've done in React Native/Expo applications
3. Briefly describe your approach to fixing our RevenueCat initialization issues
4. Outline your testing methodology for subscription-based features

We look forward to working with a skilled developer who can help us complete our subscription implementation and resolve our current issues with the RevenueCat SDK.