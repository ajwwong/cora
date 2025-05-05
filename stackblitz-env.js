// This file sets environment variables for StackBlitz environment
// Since StackBlitz doesn't load .env files the same way as local development

window.process = window.process || {};
window.process.env = window.process.env || {};

// Set required OAuth credentials
window.process.env.EXPO_PUBLIC_MEDPLUM_WEB_CLIENT_ID = "01965b46-a832-7301-a0ce-96efc842b6f4";
window.process.env.EXPO_PUBLIC_MEDPLUM_NATIVE_CLIENT_ID = "01965b47-c26d-73fb-a8bf-b5fb77c28816";

// Log for debugging
console.log('StackBlitz environment variables configured');