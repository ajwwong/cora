import { useMedplumContext } from "@medplum/react-hooks";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Purchases from "react-native-purchases";

import { CreateThreadModal } from "@/components/CreateThreadModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RevenueCatStatusPanel } from "@/components/RevenueCatStatusPanel";
import { ThreadList } from "@/components/ThreadList";
import { ThreadListHeader } from "@/components/ThreadListHeader";
import { WelcomeWalkthrough } from "@/components/WelcomeWalkthrough";
import { useAvatars } from "@/hooks/useAvatars";
import { useThreads } from "@/hooks/useThreads";
import { PushNotificationTokenManager } from "@/utils/notifications";

export default function Index() {
  const { medplum, profile } = useMedplumContext();
  const { threads, isLoading, createThread } = useThreads();
  const router = useRouter();
  const avatarReferences = useMemo(
    () =>
      threads
        .map((thread) => thread.getAvatarRef({ profile }))
        .filter((ref): ref is NonNullable<typeof ref> => !!ref?.reference), // Filter out undefined or invalid references
    [threads, profile],
  );
  const { getAvatarURL, isLoading: isAvatarsLoading } = useAvatars(avatarReferences);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showDebugButton, setShowDebugButton] = useState(__DEV__); // Only show in dev by default
  const notificationManager = useMemo(() => new PushNotificationTokenManager(medplum), [medplum]);

  // Check if we need to show the welcome walkthrough
  useEffect(() => {
    async function checkWelcomeStatus() {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem("cora-reflection-welcomed");
        if (hasSeenWelcome !== "true") {
          setShowWelcome(true);
        }
      } catch (error) {
        console.error("Error checking welcome status:", error);
        // If there's an error reading from storage, default to showing the welcome
        setShowWelcome(true);
      }
    }

    checkWelcomeStatus();
  }, []);

  const handleWelcomeClose = useCallback(async () => {
    setShowWelcome(false);
    try {
      await AsyncStorage.setItem("cora-reflection-welcomed", "true");
    } catch (error) {
      console.error("Error saving welcome status:", error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // Clear push notification token
      await notificationManager.clearProfilePushToken();

      // Logout from RevenueCat
      try {
        console.log("Logging out from RevenueCat");
        await Purchases.logOut();
        console.log("Successfully logged out from RevenueCat");
      } catch (error) {
        console.error("Error logging out from RevenueCat:", error);
        // Continue with Medplum logout even if RevenueCat logout fails
      }

      // Logout from Medplum
      medplum.signOut();

      // Redirect to sign-in
      router.replace("/sign-in");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }, [medplum, router, notificationManager]);

  // Handle secret tap area to reveal debug button
  const handleSecretTap = useCallback(() => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // Show debug button after 7 taps
    if (newTapCount >= 7) {
      setShowDebugButton(true);
      Alert.alert("Debug Mode", "Debug button enabled!");
      setTapCount(0); // Reset counter
    }

    // Reset counter after 3 seconds of no taps
    setTimeout(() => {
      setTapCount(0);
    }, 3000);
  }, [tapCount]);

  if (isLoading || isAvatarsLoading) {
    return <LoadingScreen />;
  }

  return (
    <View className="flex-1 bg-background-50">
      <ThreadListHeader onLogout={handleLogout} onCreateThread={() => setIsCreateModalOpen(true)} />
      <ThreadList
        threads={threads}
        getAvatarURL={getAvatarURL}
        onCreateThread={() => setIsCreateModalOpen(true)}
      />
      <CreateThreadModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateThread={createThread}
      />
      <WelcomeWalkthrough opened={showWelcome} onClose={handleWelcomeClose} />

      {/* Show RevenueCat status panel:
          - In development (__DEV__) it's always shown
          - In production, it's shown if showDebugPanel is true
      */}
      {(__DEV__ || showDebugPanel) && (
        <View style={{ position: "absolute", bottom: 70, left: 0, right: 0, alignItems: "center" }}>
          <RevenueCatStatusPanel />
        </View>
      )}

      {/* Secret tap area to reveal debug button */}
      <Pressable
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 80,
          height: 80,
          backgroundColor: "transparent",
        }}
        onPress={handleSecretTap}
      />

      {/* Debug button - only visible when showDebugButton is true */}
      {showDebugButton && (
        <Pressable
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            backgroundColor: "#2196f3",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            opacity: 0.7,
          }}
          onPress={() => {
            setShowDebugPanel((show) => !show);
            Alert.alert("Debug Panel", showDebugPanel ? "Debug panel hidden" : "Debug panel shown");
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 12 }}>DEBUG</Text>
        </Pressable>
      )}
    </View>
  );
}
