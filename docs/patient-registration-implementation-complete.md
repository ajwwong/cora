# Patient Registration Implementation

This document outlines the implementation of the patient self-registration feature in the Cora application, along with enhancements to the onboarding experience.

> **IMPORTANT UPDATE**: The implementation approach for registration has been updated to use a web-browser flow instead of in-app WebView for reCAPTCHA. See the [reCAPTCHA Implementation Note](recaptcha-implementation-note.md) for details and the complete implementation plan in `/root/mts/v1/feel2/docs/mobile-app-registration-flow.md`.

## Completed Features

### 1. Patient Self-Registration

We've implemented a patient self-registration flow that allows new users to create accounts. The implementation:

- Uses a web browser flow to handle reCAPTCHA verification properly
- Integrates with Medplum's registration API (`startNewUser` and `startNewPatient`)
- Connects with RevenueCat for subscription tracking
- Provides a smooth transition from registration to login
- Includes proper validation and error handling

#### Key Components:

1. **RegisterForm Component**
   - Located in `/components/RegisterForm.tsx`
   - Collects user information (first name, last name, email, password)
   - Validates input and provides feedback
   - Handles the API calls to Medplum for user and patient creation
   - Links the new user with RevenueCat for subscription management

2. **Sign-In Screen Updates**
   - Modified `/app/sign-in.tsx` to include a toggle between sign-in and registration
   - Added UI elements to allow users to switch between modes
   - Implemented handlers for successful registration

3. **Medplum OAuth2 Configuration**
   - Updated `/utils/medplum-oauth2.ts` to include the project ID needed for registration
   - Ensured proper PKCE authentication flow after registration

### 2. Enhanced Onboarding Experience

We've enhanced the welcome walkthrough to better inform new users about:

1. **Core Functionality**
   - What Cora is and how the reflection guide works
   - Text-based conversations and their benefits
   - Voice messaging capabilities and use cases

2. **Subscription Model**
   - Added a dedicated screen explaining the freemium model
   - Clearly outlines the free tier (10 voice messages per day, unlimited text)
   - Presents the Voice Connect subscription benefits
   - Uses visual elements to distinguish between plans

3. **Privacy and Security**
   - Maintained existing privacy information
   - Enhanced presentation of important reminders

#### Changes Made:

- Updated `/components/WelcomeWalkthrough.tsx`:
  - Added a new subscription plans step
  - Updated title from "Reflection Guide" to "Cora"
  - Added icons for subscription features (ZapIcon, BoltIcon)
  - Incorporated the FREE_DAILY_VOICE_MESSAGE_LIMIT constant for accurate messaging
  - Improved styling with background colors to distinguish subscription plans

## Technical Implementation Details

### Registration API Flow

1. User submits registration form with their information
2. The app calls `medplum.startNewUser()` with user details and project ID
3. On success, it calls `medplum.startNewPatient()` to create a patient resource
4. The response includes an auth code that is processed with `medplum.processCode()` to authenticate
5. After authentication, the new user ID is linked with RevenueCat via `Purchases.logIn()`
6. The user is then directed to the main app experience, starting with the welcome walkthrough

### Subscription Integration

- New users start on the free tier automatically
- The subscription status is tracked in RevenueCat and synchronized to Medplum
- The status is stored as a FHIR extension on the Patient resource
- The SubscriptionContext provides real-time access to the subscription status throughout the app

## Future Enhancements

1. **Improved Error Handling**
   - Add more detailed error messages for specific registration failures
   - Implement retry mechanisms for network issues

2. **Enhanced Onboarding**
   - Consider a guided tutorial for first-time users after registration
   - Add contextual tooltips for key features

3. **Subscription Management**
   - Add account settings screen for managing subscription
   - Implement subscription status indicators in the app

## Testing

To test the registration flow:

1. Launch the app and tap "Create Account" on the sign-in screen
2. Fill out the registration form with valid information
3. Submit the form and verify successful registration
4. Check that the welcome walkthrough appears and includes the subscription information
5. Verify that the free tier limitations apply correctly (10 voice messages per day)
6. Test upgrading to a premium subscription

To test the enhanced welcome walkthrough:

1. Launch the app with a new or existing account
2. Navigate through all steps of the walkthrough
3. Verify that the subscription plans information is clear and accurate
4. Check that all icons and visual elements render correctly