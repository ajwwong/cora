// Load StackBlitz environment variables first when in web environments
import "@/global.css";
import "expo-dev-client";

import { MedplumClient } from "@medplum/core";
import {
  ExpoClientStorage,
  initWebSocketManager,
  polyfillMedplumWebAPIs,
} from "@medplum/expo-polyfills";
import { MedplumProvider } from "@medplum/react-hooks";
import { makeRedirectUri } from "expo-auth-session";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { GluestackUIProvider } from "@/components/gluestack-ui-provider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { oauth2ClientId } from "@/utils/medplum-oauth2";

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
    Alert.alert("Your session has expired", "Please sign in again.");
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

export default function RootLayout() {
  useEffect(() => {
    // Ensures the splash screen always dismisses, even if other initialization fails
    const splashTimer = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
        console.log("Splash screen hidden successfully");
      } catch (e) {
        console.error("Error hiding splash screen:", e);
        // Force hide again after another delay as a fallback
        setTimeout(() => {
          SplashScreen.hideAsync().catch((err) =>
            console.error("Final attempt to hide splash screen failed:", err),
          );
        }, 2000);
      }
    }, 1000);

    return () => clearTimeout(splashTimer); // Clean up timeout
  }, []);

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
            <NotificationsProvider>
              <UserPreferencesProvider>
                <GestureHandlerRootView className="flex-1">
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      // Prevents flickering:
                      animation: "none",
                    }}
                  />
                </GestureHandlerRootView>
              </UserPreferencesProvider>
            </NotificationsProvider>
          </MedplumProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
