# Patient Registration Implementation Plan for Cora

This document outlines the implementation plan for adding patient self-registration capabilities to the Cora app, enabling new users to create accounts without administrator intervention.

## Overview

Currently, Cora supports authentication through Medplum's OAuth2 system but lacks a way for new patients to register. The app uses a freemium model where users get free access to text-based conversations and limited voice messaging (10 messages/day), with a premium tier (Voice Connect) that provides unlimited voice messaging.

This implementation will add a direct patient registration capability that seamlessly integrates with both Medplum authentication and RevenueCat subscription management.

## Current Architecture

Cora uses the following architecture for authentication and subscriptions:

1. **Authentication**:
   - OAuth2 authentication with Medplum via `expo-auth-session`
   - Access tokens stored and managed by the Medplum client
   - No current registration option - only existing users can sign in

2. **Subscription Integration**:
   - RevenueCat for subscription management (`react-native-purchases`)
   - Medplum user ID is used as the RevenueCat user identifier
   - FHIR extensions on the Patient resource track subscription status
   - Free tier includes 10 voice messages per day
   - Voice Connect (premium tier) provides unlimited voice messaging

## Implementation Approach

The implementation will use Medplum's direct API for patient registration rather than OAuth redirects. This approach:

1. **Provides Better User Experience**: Keeps users within our app rather than redirecting to external sites
2. **Maintains Control**: Gives us more control over the registration process and error handling
3. **Supports Our Freemium Model**: Allows setting up proper subscription defaults for new users
4. **Integrates Smoothly**: Works with our existing RevenueCat implementation

## Implementation Steps

### 1. Create Registration Form Component

Create a new component at `components/RegisterForm.tsx`:

```typescript
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useMedplum } from '@medplum/react-hooks';
import Purchases from 'react-native-purchases';
import { Text, VStack, Input, Button, ButtonText, FormControl, FormControlLabel, FormControlLabelText, FormControlHelper, FormControlHelperText, FormControlError, FormControlErrorText } from './ui';

interface RegisterFormProps {
  projectId: string;
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RegisterForm({ projectId, clientId, onSuccess, onCancel }: RegisterFormProps) {
  const medplum = useMedplum();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      // Step 1: Create new user
      console.log('Starting patient registration...');
      const response = await medplum.startNewUser({
        firstName,
        lastName,
        email,
        password,
        projectId,
        clientId,
      });
      
      if (response.login) {
        console.log('User created, registering patient...');
        
        // Step 2: Create patient profile
        const patientResponse = await medplum.startNewPatient({
          login: response.login,
          projectId,
        });
        
        if (patientResponse.code) {
          console.log('Patient registered, processing auth code...');
          
          // Step 3: Process the auth code to sign in
          await medplum.processCode(patientResponse.code);
          
          // Step 4: Link with RevenueCat
          const profile = medplum.getProfile();
          if (profile?.id) {
            console.log('Linking new patient with RevenueCat:', profile.id);
            try {
              await Purchases.logIn(profile.id);
              console.log('Successfully linked with RevenueCat');
            } catch (rcError) {
              console.error('Error linking with RevenueCat:', rcError);
              // Continue even if RevenueCat fails - non-critical
            }
          }
          
          // Registration complete
          onSuccess();
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Registration Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="w-full">
      <VStack space="md" className="w-full mb-4">
        <Text className="text-2xl font-bold text-center mb-4">Create Your Account</Text>
        
        <FormControl isInvalid={!!errors.firstName}>
          <FormControlLabel>
            <FormControlLabelText>First Name</FormControlLabelText>
          </FormControlLabel>
          <Input
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Your first name"
            autoCapitalize="words"
            isDisabled={isSubmitting}
          />
          {errors.firstName && (
            <FormControlError>
              <FormControlErrorText>{errors.firstName}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>
        
        <FormControl isInvalid={!!errors.lastName}>
          <FormControlLabel>
            <FormControlLabelText>Last Name</FormControlLabelText>
          </FormControlLabel>
          <Input
            value={lastName}
            onChangeText={setLastName}
            placeholder="Your last name"
            autoCapitalize="words"
            isDisabled={isSubmitting}
          />
          {errors.lastName && (
            <FormControlError>
              <FormControlErrorText>{errors.lastName}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>
        
        <FormControl isInvalid={!!errors.email}>
          <FormControlLabel>
            <FormControlLabelText>Email</FormControlLabelText>
          </FormControlLabel>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="your.email@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            isDisabled={isSubmitting}
          />
          {errors.email && (
            <FormControlError>
              <FormControlErrorText>{errors.email}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>
        
        <FormControl isInvalid={!!errors.password}>
          <FormControlLabel>
            <FormControlLabelText>Password</FormControlLabelText>
          </FormControlLabel>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Create a secure password"
            secureTextEntry
            isDisabled={isSubmitting}
          />
          <FormControlHelper>
            <FormControlHelperText>Must be at least 8 characters</FormControlHelperText>
          </FormControlHelper>
          {errors.password && (
            <FormControlError>
              <FormControlErrorText>{errors.password}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>
        
        <Text className="text-xs text-gray-500 mt-2">
          By creating an account, you agree to our Privacy Policy and Terms of Service.
        </Text>
      </VStack>
      
      <Button
        action="primary"
        size="lg"
        onPress={handleSubmit}
        isDisabled={isSubmitting}
        isFocusVisible={false}
        className="w-full mb-3"
      >
        <ButtonText>{isSubmitting ? 'Creating Account...' : 'Create Account'}</ButtonText>
      </Button>
      
      <Button
        variant="outline"
        size="lg"
        onPress={onCancel}
        isDisabled={isSubmitting}
        isFocusVisible={false}
        className="w-full"
      >
        <ButtonText>Back to Sign In</ButtonText>
      </Button>
    </View>
  );
}
```

### 2. Modify Sign-In Screen

Update `app/sign-in.tsx` to include registration functionality:

```typescript
import { LoginState } from "@medplum/core";
import { useMedplum } from "@medplum/react-hooks";
import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseError,
  TokenResponse,
} from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import Purchases from "react-native-purchases";

import { Button, ButtonText } from "@/components/ui/button";
import { RegisterForm } from "@/components/RegisterForm";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { oauth2ClientId, oAuth2Discovery } from "@/utils/medplum-oauth2";

// Based on https://docs.expo.dev/guides/authentication/#calendly
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const router = useRouter();
  const medplum = useMedplum();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const isLoading = isLoginLoading || !medplum.isInitialized;

  const redirectAfterLogin = useCallback(() => {
    // Workaround for disabling back button after login:
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  }, [router]);

  const processTokenResponse = useCallback(
    async (tokenResponse: TokenResponse) => {
      try {
        // Set active login in Medplum
        await medplum.setActiveLogin({
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
        } as LoginState);

        // Get user profile to use as RevenueCat identifier
        const profile = medplum.getProfile();
        if (profile?.id) {
          console.log("Logging in to RevenueCat with user ID:", profile.id);
          try {
            // Log in to RevenueCat with the user's Medplum ID
            await Purchases.logIn(profile.id);
            console.log("Successfully logged in to RevenueCat");
          } catch (error) {
            console.error("Error logging in to RevenueCat:", error);
            // Don't block the login process if RevenueCat fails
          }
        }

        redirectAfterLogin();
      } catch (error) {
        console.error("Error processing token response:", error);
        Alert.alert("Authentication Error", "Failed to complete login process. Please try again.");
      }
    },
    [medplum, redirectAfterLogin],
  );

  const medplumLogin = useCallback(async () => {
    const loginRequest = new AuthRequest({
      clientId: oauth2ClientId,
      usePKCE: true,
      // Redirect URI must match Medplum config, see README.md
      redirectUri: makeRedirectUri(),
      scopes: ["openid"],
    });
    let loginResponse;
    try {
      loginResponse = await loginRequest.promptAsync(oAuth2Discovery);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert("Authentication error", error.message);
        if (__DEV__) {
          console.error(error);
        }
      }
      return;
    }

    if (loginResponse.type === "error") {
      Alert.alert(
        "Authentication error",
        loginResponse.params.error_description || "something went wrong",
      );
      if (__DEV__) {
        console.error(loginResponse.params.error_description);
      }
      return;
    }

    if (loginResponse.type === "success") {
      try {
        const tokenResponse = await exchangeCodeAsync(
          {
            clientId: oauth2ClientId,
            code: loginResponse.params.code,
            redirectUri: loginRequest.redirectUri,
            extraParams: {
              code_verifier: loginRequest.codeVerifier!,
            },
          },
          oAuth2Discovery,
        );
        await processTokenResponse(tokenResponse);
      } catch (error) {
        if (error instanceof ResponseError) {
          if (
            error.code === "invalid_request" &&
            error.description?.includes("Invalid code verifier")
          ) {
            // If the user tries to login right after unsuccessfully logging out,
            // the server returns an invalid_request error.
            // We can ignore and try again:
            return medplumLogin();
          }
          Alert.alert("Authentication error", error.message);
          if (__DEV__) {
            console.error(error);
          }
        }
      }
    }
  }, [processTokenResponse]);

  const handleLogin = useCallback(() => {
    setIsLoginLoading(true);
    medplumLogin().finally(() => setIsLoginLoading(false));
  }, [medplumLogin]);

  const handleRegisterSuccess = useCallback(() => {
    // Registration automatically logs the user in, so just redirect
    redirectAfterLogin();
  }, [redirectAfterLogin]);

  const toggleRegistration = useCallback(() => {
    setShowRegister((prev) => !prev);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background-50">
      {isLoading && <Spinner size="large" />}
      {!isLoading && !showRegister && (
        <VStack space="md" className="w-[90%] max-w-[350px]">
          <Text className="text-center text-2xl font-bold mb-6">Welcome to Cora</Text>
          <Button action="primary" size="lg" onPress={handleLogin}>
            <ButtonText>Sign In</ButtonText>
          </Button>
          <Button action="secondary" variant="outline" size="lg" onPress={toggleRegistration}>
            <ButtonText>Create Account</ButtonText>
          </Button>
        </VStack>
      )}
      {!isLoading && showRegister && (
        <View className="w-[90%] max-w-[350px]">
          <RegisterForm
            projectId="PROJECT_ID_HERE" // Replace with your project ID
            clientId={oauth2ClientId}
            onSuccess={handleRegisterSuccess}
            onCancel={toggleRegistration}
          />
        </View>
      )}
    </View>
  );
}
```

### 3. Configuration Updates

Update `/utils/medplum-oauth2.ts` to include the Medplum project ID:

```typescript
import { Platform } from "react-native";

// Added fallback values to prevent undefined client_id in StackBlitz and other environments
export const oauth2ClientId =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_MEDPLUM_WEB_CLIENT_ID || "01965b46-a832-7301-a0ce-96efc842b6f4"
    : process.env.EXPO_PUBLIC_MEDPLUM_NATIVE_CLIENT_ID || "01965b47-c26d-73fb-a8bf-b5fb77c28816";

export const medplumProjectId = process.env.EXPO_PUBLIC_MEDPLUM_PROJECT_ID || "your-medplum-project-id";

export const oAuth2Discovery = {
  authorizationEndpoint: "https://api.progressnotes.app/oauth2/authorize",
  tokenEndpoint: "https://api.progressnotes.app/oauth2/token",
  userInfoEndpoint: "https://api.progressnotes.app/oauth2/userinfo",
  //  authorizationEndpoint: "https://api.medplum.com/oauth2/authorize",
  //  tokenEndpoint: "https://api.medplum.com/oauth2/token",
  //  userInfoEndpoint: "https://api.medplum.com/oauth2/userinfo",
};
```

### 4. Welcome and Onboarding Flow (Optional Enhancement)

Optionally update the `WelcomeWalkthrough` component to provide guidance for new users:

```typescript
// In components/WelcomeWalkthrough.tsx
export function WelcomeWalkthrough({ opened, onClose }: WelcomeWalkthroughProps) {
  return (
    <Modal isOpen={opened} onClose={onClose}>
      <ModalHeader>Welcome to Cora</ModalHeader>
      <ModalBody>
        <ScrollView>
          <VStack space="md">
            <Heading size="lg">Your Reflection Guide</Heading>
            <Text>
              Cora helps you explore your thoughts and feelings through guided 
              conversations with our AI reflection assistant.
            </Text>
            
            <Heading size="md">How to get started:</Heading>
            <Text>1. Create a new reflection session</Text>
            <Text>2. Type or speak your thoughts</Text>
            <Text>3. Receive supportive, reflective responses</Text>
            
            <Heading size="md">Voice Connect Subscription:</Heading>
            <Text>
              The free Text Companion tier includes text conversations and 
              up to 10 voice messages per day. Upgrade to Voice Connect 
              for unlimited voice messaging.
            </Text>
          </VStack>
        </ScrollView>
      </ModalBody>
      <ModalFooter>
        <Button onPress={onClose} flex={1}>
          <ButtonText>Get Started</ButtonText>
        </Button>
      </ModalFooter>
    </Modal>
  );
}
```

## Testing Plan

1. **Registration Flow**
   - Test form validation with invalid inputs
   - Test successful registration flow
   - Verify user is properly created in Medplum
   - Check that user is automatically logged in after registration

2. **RevenueCat Integration**
   - Verify that the Medplum user ID is properly linked to RevenueCat
   - Test that subscription status checks work after registration
   - Verify free tier limitations (10 voice messages/day) apply properly

3. **Error Handling**
   - Test registration with an email already in use
   - Test recovery from network issues
   - Verify proper error messages are displayed

4. **Cross-Device Testing**
   - Test registration process on iOS and Android
   - Verify UI display on various screen sizes

## Implementation Timeline

| Task | Estimated Time |
|------|---------------|
| Create RegisterForm component | 3-4 hours |
| Modify sign-in screen | 1-2 hours |
| Configuration updates | 1 hour |
| Welcome walkthrough enhancements | 2-3 hours |
| Integration testing | 3-4 hours |
| Bug fixes and refinements | 2-3 hours |

## Medplum Server-Side Configuration

Before implementing this solution, ensure the Medplum project is configured properly:

1. **Access Policies**
   - Ensure the project has an access policy for patients that restricts them to viewing/editing their own data
   - Set this policy as the default for new patients

2. **Project Settings**
   - Enable "Allow Public Registration" for patients in the Medplum admin console
   - Configure appropriate default permissions for newly registered patients

## Conclusion

This implementation plan provides a direct, in-app registration flow for new Cora users, maintaining the existing freemium model while eliminating the need for administrator intervention. The approach keeps users within the application and provides a smoother onboarding experience.

By using Medplum's API directly (rather than OAuth redirects), we gain more control over the registration process and can properly integrate with RevenueCat immediately after registration. This ensures that voice message limitations are consistently applied from the first login.

After implementation, users will be able to self-register, automatically receive the free tier (with 10 voice messages per day), and upgrade to Voice Connect if they need unlimited voice messaging capabilities.