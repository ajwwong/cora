// Load StackBlitz environment variables first when in web environments
import "@/global.css";
import "expo-dev-client";

import { Nunito_400Regular, Nunito_700Bold, useFonts } from "@expo-google-fonts/nunito";
import { MedplumClient } from "@medplum/core";
import {
  ExpoClientStorage,
  initWebSocketManager,
  polyfillMedplumWebAPIs,
} from "@medplum/expo-polyfills";
import { MedplumProvider } from "@medplum/react-hooks";
import { makeRedirectUri } from "expo-auth-session";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Purchases from "react-native-purchases";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { GluestackUIProvider } from "@/components/gluestack-ui-provider";
import { GlobalAudioProvider } from "@/contexts/GlobalAudioContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { DebugRevenueCat } from "@/debug-revenuecat";
import { oauth2ClientId } from "@/utils/medplum-oauth2";
import { trackUserAction } from "@/utils/system-logging";

if (typeof window !== "undefined") {
  import("../stackblitz-env.js").catch((err) =>
    console.warn("Could not load StackBlitz environment:", err),
  );
}

export const unstable_settings = {
  initialRouteName: "/(app)",
};

SplashScreen.preventAutoHideAsync();

polyfillMedplumWebAPIs();

console.log("Initializing Medplum client with OAuth client ID:", oauth2ClientId);

// Create the Medplum client
const medplum = new MedplumClient({
  baseUrl: "https://api.progressnotes.app/",
  clientId: oauth2ClientId,
  storage: new ExpoClientStorage(),
  onUnauthenticated: () => {
    console.log("Session is unauthenticated, redirecting to sign-in");
    router.replace("/sign-in");
  },
});

// Initialize WebSocket manager
try {
  initWebSocketManager(medplum);
  console.log("WebSocket manager initialized successfully");
} catch (error) {
  console.error("Error initializing WebSocket manager:", error);
}

// Initialize RevenueCat as early as possible in the app lifecycle
// EMERGENCY DEBUG CODE - Let's display SDK status immediately on app startup
// Helper to log alerts to AuditEvent resources
const logAlertToAuditEvent = async (title: string, message: string) => {
  try {
    // Wait for Medplum to be ready
    if (!medplum || !medplum.getProfile()?.id) {
      setTimeout(() => logAlertToAuditEvent(title, message), 5000);
      return;
    }

    const profile = medplum.getProfile();
    if (profile?.id) {
      await trackUserAction({
        medplum,
        patientId: profile.id,
        action: `ALERT: ${title}`,
        details: JSON.stringify({
          message,
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
        }),
        success: true,
      });
    }
  } catch (error) {
    console.error(`Failed to log alert "${title}" to AuditEvent:`, error);
  }
};

// RevenueCat initialization is now handled through the subscription context
// All logging goes to AuditEvent resources instead of user-facing alerts

export default function RootLayout() {
  // Load Nunito fonts
  const [fontsLoaded, fontError] = useFonts({
    "Nunito-Regular": Nunito_400Regular,
    "Nunito-Bold": Nunito_700Bold,
  });

  const _segments = useSegments();

  // Handle deep linking
  useEffect(() => {
    // Function to handle deep link URLs
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;

      console.log("Handling deep link or navigation:", url);

      // Handle both deep links and web navigation callbacks
      if (url.startsWith("feelheard://register") || url.includes("/register-callback")) {
        // Parse the URL to get parameters
        const parsed = new URL(url);
        const success = parsed.searchParams.get("success");

        if (success === "true") {
          // Check if we have auth tokens for auto-login
          const accessToken = parsed.searchParams.get("access_token");
          const refreshToken = parsed.searchParams.get("refresh_token");
          const profileId = parsed.searchParams.get("profile_id");

          if (accessToken && refreshToken) {
            try {
              // Set active login using the tokens from the web registration
              await medplum.setActiveLogin({
                accessToken,
                refreshToken,
                profile: profileId || undefined,
              });

              // Verify login was successful
              await medplum.getActiveLogin();

              // Link with RevenueCat if we have a profile ID
              if (profileId) {
                try {
                  await Purchases.logIn(profileId);
                } catch (rcError) {
                  console.error("Error linking with RevenueCat:", rcError);
                  // Continue even if RevenueCat fails - non-critical
                }
              }

              // Redirect to main app
              router.replace("/");
            } catch (error) {
              console.error("Auto-login failed:", error);
              // If auto-login fails, redirect to sign-in page
              Alert.alert(
                "Authentication error",
                "We couldn't automatically sign you in. Please sign in with your new account.",
              );
              router.replace("/sign-in");
            }
          } else {
            // Registration was successful but without auth tokens
            Alert.alert(
              "Account Created",
              "Your account has been created successfully. Please sign in.",
            );
            router.replace("/sign-in");
          }
        } else {
          // Registration was cancelled or failed, go back to sign in
          router.replace("/sign-in");
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Parse initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("App opened with initial URL:", url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Ensures the splash screen dismisses after fonts load or on error
    if (fontsLoaded || fontError) {
      try {
        SplashScreen.hideAsync();
        console.log("Splash screen hidden successfully");
      } catch (e) {
        console.error("Error hiding splash screen:", e);
        // Force hide again after delay as fallback
        setTimeout(() => {
          SplashScreen.hideAsync().catch((err) =>
            console.error("Final attempt to hide splash screen failed:", err),
          );
        }, 2000);
      }
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Print redirect URL on startup
    if (__DEV__) {
      console.log("Redirect URL:", makeRedirectUri());
    }
  }, []);

  const { colorScheme } = useColorScheme();
  return (
    <GluestackUIProvider mode={colorScheme}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar />
        <SafeAreaView className="h-full bg-background-0 md:w-full">
          <MedplumProvider medplum={medplum}>
            <DebugRevenueCat />
            <NotificationsProvider>
              <UserPreferencesProvider>
                <SubscriptionProvider>
                  <GlobalAudioProvider>
                    <KeyboardProvider>
                      <GestureHandlerRootView className="flex-1">
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            // Prevents flickering:
                            animation: "none",
                          }}
                        />
                      </GestureHandlerRootView>
                    </KeyboardProvider>
                  </GlobalAudioProvider>
                </SubscriptionProvider>
              </UserPreferencesProvider>
            </NotificationsProvider>
          </MedplumProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
