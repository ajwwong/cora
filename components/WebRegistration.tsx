import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Alert, Linking, Platform, View } from "react-native";

import { Button, ButtonText } from "./ui/button";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

interface WebRegistrationProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function WebRegistration({ onSuccess, onCancel }: WebRegistrationProps) {
  // Base URL for the web registration page
  const registrationUrl = "https://www.feelheard.me/register";

  // Launch the browser to the registration page
  const launchWebRegistration = async () => {
    try {
      // Choose appropriate redirect URI based on platform
      let redirectUri;

      if (Platform.OS === "web") {
        // For web, use the current origin with a callback path
        const origin = window.location.origin;
        redirectUri = `${origin}/register-callback`;
      } else {
        // For mobile, use the deep link scheme
        redirectUri = "feelheard://register";
      }

      // Construct the full URL with redirect
      const fullUrl = `${registrationUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log("Registration URL:", fullUrl);

      // For mobile, try multiple approaches in sequence if needed
      if (Platform.OS === "web") {
        window.open(fullUrl, "_blank");
      } else {
        try {
          console.log("Attempting to open browser with WebBrowser.openBrowserAsync");
          await WebBrowser.openBrowserAsync(fullUrl);
        } catch (browserError) {
          console.error("WebBrowser.openBrowserAsync failed:", browserError);

          try {
            // Fallback to WebBrowser.openAuthSessionAsync which handles redirects better
            console.log("Attempting WebBrowser.openAuthSessionAsync as fallback");
            await WebBrowser.openAuthSessionAsync(fullUrl, "feelheard://register");
          } catch (authSessionError) {
            console.error("WebBrowser.openAuthSessionAsync failed:", authSessionError);

            // Last resort: try standard Linking
            console.log("Attempting Linking.openURL as last resort");
            await Linking.openURL(fullUrl);
          }
        }
      }
    } catch (error) {
      console.error("Error opening browser for registration:", error);
      Alert.alert(
        "Browser Error",
        "Unable to open your browser. Please try again or register directly at www.feelheard.me",
      );
    }
  };

  return (
    <View className="flex-1 items-center justify-center">
      <VStack space="md" className="w-[90%] max-w-[350px]">
        <Text className="mb-4 text-center text-2xl font-bold">Create Your Account</Text>
        <Text className="mb-6 text-center text-base">
          {Platform.OS === "web"
            ? "You'll be redirected to our secure registration page to create your FeelHeard account."
            : "You'll be redirected to our secure registration page to create your FeelHeard account. After you finish registration, return to this app and sign in."}
        </Text>
        <Button action="primary" size="lg" onPress={launchWebRegistration} className="w-full">
          <ButtonText>Continue to Registration</ButtonText>
        </Button>
        <Button variant="outline" size="lg" onPress={onCancel} className="w-full">
          <ButtonText>Cancel</ButtonText>
        </Button>
      </VStack>
    </View>
  );
}
