// ARCHIVED: This in-app registration form with reCAPTCHA was replaced with a web browser approach.
// See /docs/patient-registration-implementation-complete.md and /docs/recaptcha-implementation-note.md for details.
// Date archived: Sun May 11 18:58:52 PDT 2025
import { useMedplum } from "@medplum/react-hooks";
import React, { useState } from "react";
import { Alert, View } from "react-native";
import Purchases from "react-native-purchases";

import { Button, ButtonText } from "../../components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "../../components/ui/form-control";
import { Input, InputField } from "../../components/ui/input";
import { Text } from "../../components/ui/text";
import { VStack } from "../../components/ui/vstack";
import RecaptchaModal from "./RecaptchaModal";

interface RegisterFormProps {
  projectId: string;
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RegisterForm({ projectId, clientId, onSuccess, onCancel }: RegisterFormProps) {
  const medplum = useMedplum();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email is invalid";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Show reCAPTCHA if we don't have a token yet
    if (!recaptchaToken) {
      setShowRecaptcha(true);
      return;
    }

    try {
      setIsSubmitting(true);

      // Step 1: Create new user
      console.log("Starting patient registration with reCAPTCHA token...");

      const response = await medplum.startNewUser({
        firstName,
        lastName,
        email,
        password,
        projectId,
        clientId,
        recaptchaToken: recaptchaToken,
      });

      if (response.login) {
        console.log("User created, registering patient...");

        // Step 2: Create patient profile
        const patientResponse = await medplum.startNewPatient({
          login: response.login,
          projectId,
        });

        if (patientResponse.code) {
          console.log("Patient registered, processing auth code...");

          // Step 3: Process the auth code to sign in
          await medplum.processCode(patientResponse.code);

          // Step 4: Link with RevenueCat
          const profile = medplum.getProfile();
          if (profile?.id) {
            console.log("Linking new patient with RevenueCat:", profile.id);
            try {
              await Purchases.logIn(profile.id);
              console.log("Successfully linked with RevenueCat");
            } catch (rcError) {
              console.error("Error linking with RevenueCat:", rcError);
              // Continue even if RevenueCat fails - non-critical
            }
          }

          // Registration complete
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      let errorMessage = "Registration failed. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (errorMessage.includes("Recaptcha token")) {
        errorMessage =
          "Registration temporarily unavailable. Please try again later or contact support.";
      }

      Alert.alert("Registration Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecaptchaVerify = (token: string) => {
    console.log("reCAPTCHA token received");
    setRecaptchaToken(token);

    // Continue with the form submission now that we have a token
    if (token) {
      handleSubmit();
    }
  };

  const handleRecaptchaError = (error: string) => {
    console.error("reCAPTCHA error:", error);
    Alert.alert("Verification Error", "Could not verify that you are human. Please try again.");
    setShowRecaptcha(false);
  };

  return (
    <View className="w-full">
      <VStack space="md" className="mb-4 w-full">
        <Text className="mb-4 text-center text-2xl font-bold">Create Your Account</Text>

        {/* reCAPTCHA Modal */}
        <RecaptchaModal
          visible={showRecaptcha}
          onClose={() => setShowRecaptcha(false)}
          onVerify={handleRecaptchaVerify}
          onError={handleRecaptchaError}
        />

        <FormControl isInvalid={!!errors.firstName}>
          <FormControlLabel>
            <FormControlLabelText>First Name</FormControlLabelText>
          </FormControlLabel>
          <Input size="md" isDisabled={isSubmitting}>
            <InputField
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Your first name"
              autoCapitalize="words"
              className="min-h-[44px] py-3"
              accessibilityLabel="First Name"
            />
          </Input>
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
          <Input size="md" isDisabled={isSubmitting}>
            <InputField
              value={lastName}
              onChangeText={setLastName}
              placeholder="Your last name"
              autoCapitalize="words"
              className="min-h-[44px] py-3"
              accessibilityLabel="Last Name"
            />
          </Input>
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
          <Input size="md" isDisabled={isSubmitting}>
            <InputField
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="min-h-[44px] py-3"
              accessibilityLabel="Email Address"
            />
          </Input>
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
          <Input size="md" isDisabled={isSubmitting}>
            <InputField
              value={password}
              onChangeText={setPassword}
              placeholder="Create a secure password"
              secureTextEntry
              className="min-h-[44px] py-3"
              accessibilityLabel="Password"
            />
          </Input>
          <FormControlHelper>
            <FormControlHelperText>Must be at least 8 characters</FormControlHelperText>
          </FormControlHelper>
          {errors.password && (
            <FormControlError>
              <FormControlErrorText>{errors.password}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>

        <Text className="mt-2 text-xs text-gray-500">
          By creating an account, you agree to our Privacy Policy and Terms of Service.
        </Text>
      </VStack>

      <Button
        action="primary"
        size="lg"
        onPress={handleSubmit}
        isDisabled={isSubmitting}
        isFocusVisible={false}
        className="mb-3 w-full"
      >
        <ButtonText>{isSubmitting ? "Creating Account..." : "Create Account"}</ButtonText>
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
