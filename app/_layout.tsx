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
import { GlobalAudioProvider } from "@/contexts/GlobalAudioContext";
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
  // Load Nunito fonts
  const [fontsLoaded, fontError] = useFonts({
    "Nunito-Regular": Nunito_400Regular,
    "Nunito-Bold": Nunito_700Bold,
  });

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
            <NotificationsProvider>
              <UserPreferencesProvider>
                <GlobalAudioProvider>
                  <GestureHandlerRootView className="flex-1">
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        // Prevents flickering:
                        animation: "none",
                      }}
                    />
                  </GestureHandlerRootView>
                </GlobalAudioProvider>
              </UserPreferencesProvider>
            </NotificationsProvider>
          </MedplumProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}
