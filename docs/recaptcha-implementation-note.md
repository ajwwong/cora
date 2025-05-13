# reCAPTCHA Implementation Notes

## Implementation History

Initially, we attempted to implement reCAPTCHA directly within the Cora mobile app using a WebView approach. However, we encountered several challenges:

1. When using WebView for reCAPTCHA in the mobile app, the origin is `about:blank`, which cannot be added to the allowed domains list in Google reCAPTCHA
2. Medplum's registration API requires a valid reCAPTCHA token for security
3. Tokens generated from unregistered domains are rejected with "Recaptcha failed" errors

## Current Approach

After researching various options, we decided to implement a web-to-app flow for registration:

1. Open the device's web browser to our existing web registration page
2. Complete registration on the web (with proper reCAPTCHA verification)
3. Redirect back to the mobile app using a custom URI scheme

This approach leverages our existing web registration implementation which has working reCAPTCHA integration, avoiding the domain validation issues in WebViews.

## Archived Components

The following components from our initial WebView-based reCAPTCHA implementation have been archived:

- `/archive/components/RecaptchaModal.tsx` - WebView component for reCAPTCHA in the app
- `/archive/components/RegisterForm.tsx` - Form component with in-app reCAPTCHA implementation

## Current Implementation

The current implementation follows the plan documented in the Feel2 repository:
`/root/mts/v1/feel2/docs/mobile-app-registration-flow.md`

This web-to-app approach is consistent with industry best practices for handling complex authentication flows in mobile apps and provides a more reliable user experience.