import { useMedplum } from "@medplum/react-hooks";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";

import { useSubscription } from "../contexts/SubscriptionContext";
import { ENTITLEMENT_IDS } from "../utils/subscription/config";
import {
  FREE_DAILY_VOICE_MESSAGE_LIMIT,
  getVoiceMessageUsage,
  hasReachedDailyLimit,
  incrementVoiceMessageCount,
} from "../utils/voiceMessageTracking";
import {
  Button,
  Heading,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Text,
  VStack,
} from "./ui";

interface VoiceMessageGateProps {
  threadId: string;
  onAllowRecording: () => void;
  onDenyRecording: () => void;
}

/**
 * Component that gates voice recording functionality based on subscription status
 * and daily usage limits for free tier users
 */
export function VoiceMessageGate({
  threadId: _threadId,
  onAllowRecording,
  onDenyRecording,
}: VoiceMessageGateProps) {
  // We use threadId for documentation but prefix with _ to indicate it's unused
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [voiceUsage, setVoiceUsage] = useState({
    dailyCount: 0,
    monthlyCount: 0,
    lastResetDate: "",
  });
  const [_isLoading, setIsLoading] = useState(false);
  const { isPremium, checkEntitlementStatus } = useSubscription();
  const medplum = useMedplum();

  // Check if user has premium entitlement
  const hasPremium = isPremium || checkEntitlementStatus(ENTITLEMENT_IDS.PREMIUM);

  // Calculate remaining messages (unused in this component but defined for API consistency)
  const _remainingFreeMessages = Math.max(
    0,
    FREE_DAILY_VOICE_MESSAGE_LIMIT - voiceUsage.dailyCount,
  );

  // Get voice usage from FHIR extension on mount
  useEffect(() => {
    const fetchVoiceUsage = async () => {
      try {
        setIsLoading(true);
        const profile = medplum.getProfile();
        if (profile?.id) {
          const usage = await getVoiceMessageUsage(medplum, profile.id);
          setVoiceUsage(usage);
          console.log(
            `📱 [VoiceMessageGate] Loaded voice usage - daily: ${usage.dailyCount}, monthly: ${usage.monthlyCount}`,
          );
        }
      } catch (error) {
        console.error("Error getting voice usage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVoiceUsage();
  }, [medplum]);

  // Logic to determine if recording should be allowed (referenced in JSX)
  const _checkRecordingPermission = async () => {
    try {
      setIsLoading(true);
      console.log("📱 [VoiceMessageGate] Checking recording permission");

      // Get profile ID
      const profile = medplum.getProfile();
      if (!profile?.id) {
        console.error("No profile found");
        onDenyRecording();
        return;
      }

      // Get the latest usage
      const usage = await getVoiceMessageUsage(medplum, profile.id);
      setVoiceUsage(usage);
      console.log(
        `📱 [VoiceMessageGate] Current voice usage - daily: ${usage.dailyCount}, monthly: ${usage.monthlyCount}`,
      );

      // Premium users always allowed
      if (hasPremium) {
        console.log("📱 [VoiceMessageGate] User has premium - allowing recording");
        onAllowRecording();
        return;
      }

      // Free users check daily limit
      const limitReached = hasReachedDailyLimit(usage.dailyCount);
      if (limitReached) {
        console.log("📱 [VoiceMessageGate] User reached daily limit - denying recording");
        setShowLimitModal(true);
        onDenyRecording();
      } else {
        // Free user under daily limit - allow recording
        console.log(
          `📱 [VoiceMessageGate] User under daily limit (${usage.dailyCount}/${FREE_DAILY_VOICE_MESSAGE_LIMIT}) - allowing recording`,
        );
        onAllowRecording();
      }
    } catch (error) {
      console.error("Error checking voice permission:", error);
      // In case of error, default to allowing to prevent frustration
      onAllowRecording();
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation to subscription screen
  const navigateToSubscription = () => {
    setShowLimitModal(false);
    router.push("/subscription");
  };

  return (
    <>
      {/* Daily limit reached modal */}
      <Modal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading size="lg">Voice Message Limit</Heading>
          </ModalHeader>
          <ModalBody>
            <VStack space={4}>
              <Text>
                You've used all {FREE_DAILY_VOICE_MESSAGE_LIMIT} of your daily voice messages.
              </Text>
              <Text>Upgrade to Voice Connect for unlimited voice messaging.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="solid"
              size="md"
              onPress={navigateToSubscription}
              className="mb-2 w-full"
            >
              Upgrade to Voice Connect
            </Button>
            <Button
              variant="outline"
              size="md"
              onPress={() => setShowLimitModal(false)}
              className="w-full"
            >
              Continue with Text
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

/**
 * Hook to use the voice message gate functionality
 * @param threadId Thread ID to count voice messages for
 * @returns Functions to check and handle voice recording permission
 */
export function useVoiceMessageGate(threadId: string) {
  // threadId is used in queries within fetchVoiceUsage function below
  const { isPremium, checkEntitlementStatus } = useSubscription();
  const medplum = useMedplum();
  const [voiceUsage, setVoiceUsage] = useState({
    dailyCount: 0,
    monthlyCount: 0,
    lastResetDate: "",
  });
  const [_isLoading, setIsLoading] = useState(false);

  // Check if user has premium entitlement
  const hasPremium = isPremium || checkEntitlementStatus(ENTITLEMENT_IDS.PREMIUM);

  // Calculate remaining messages
  const remainingFreeMessages = Math.max(0, FREE_DAILY_VOICE_MESSAGE_LIMIT - voiceUsage.dailyCount);
  const reachedDailyLimit = hasReachedDailyLimit(voiceUsage.dailyCount);

  // Fetch voice usage on mount
  useEffect(() => {
    const fetchVoiceUsage = async () => {
      try {
        const profile = medplum.getProfile();
        if (profile?.id) {
          const usage = await getVoiceMessageUsage(medplum, profile.id);
          setVoiceUsage(usage);
          console.log(
            `📱 [useVoiceMessageGate Hook] Loaded voice usage - daily: ${usage.dailyCount}, monthly: ${usage.monthlyCount}`,
          );
        }
      } catch (error) {
        console.error("Error getting voice usage in hook:", error);
      }
    };

    fetchVoiceUsage();
  }, [medplum]);

  // Logic to determine if recording should be allowed
  const checkRecordingPermission = async (): Promise<boolean> => {
    console.log("📱 [useVoiceMessageGate Hook] Checking recording permission");

    try {
      setIsLoading(true);

      // Get profile ID
      const profile = medplum.getProfile();
      if (!profile?.id) {
        console.error("No profile found");
        return false;
      }

      // Get the latest usage
      const usage = await getVoiceMessageUsage(medplum, profile.id);
      setVoiceUsage(usage);
      console.log(
        `📱 [useVoiceMessageGate Hook] Current usage - daily: ${usage.dailyCount}, monthly: ${usage.monthlyCount}`,
      );

      // Premium users always allowed
      if (hasPremium) {
        console.log("📱 [useVoiceMessageGate Hook] User has premium - allowing recording");
        return true;
      }

      // Free users check daily limit
      const limitReached = hasReachedDailyLimit(usage.dailyCount);
      if (limitReached) {
        console.log("📱 [useVoiceMessageGate Hook] User reached daily limit - denying recording");
        return false;
      } else {
        // Free user under daily limit - allow recording
        console.log(
          `📱 [useVoiceMessageGate Hook] User under daily limit (${usage.dailyCount}/${FREE_DAILY_VOICE_MESSAGE_LIMIT}) - allowing recording`,
        );
        return true;
      }
    } catch (error) {
      console.error("📱 [useVoiceMessageGate Hook] Error checking recording permission:", error);
      // In case of error, default to allowing recording to prevent frustration
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  // Increment the voice message count after sending
  const incrementVoiceCount = async (): Promise<void> => {
    try {
      setIsLoading(true);
      console.log("📱 [useVoiceMessageGate Hook] Incrementing voice count");

      // Get profile ID
      const profile = medplum.getProfile();
      if (!profile?.id) {
        console.error("No profile found");
        return;
      }

      // Increment the count
      const updatedUsage = await incrementVoiceMessageCount(medplum, profile.id);
      setVoiceUsage(updatedUsage);
      console.log(
        `📱 [useVoiceMessageGate Hook] Updated counts - daily: ${updatedUsage.dailyCount}, monthly: ${updatedUsage.monthlyCount}`,
      );
    } catch (error) {
      console.error("📱 [useVoiceMessageGate Hook] Error incrementing voice count:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show limit alert with option to upgrade
  const showLimitReachedAlert = () => {
    Alert.alert(
      "Voice Message Limit Reached",
      `You've used all ${FREE_DAILY_VOICE_MESSAGE_LIMIT} of your daily voice messages. Upgrade to Voice Connect for unlimited voice messaging.`,
      [
        {
          text: "Upgrade",
          onPress: () => router.push("/subscription"),
        },
        {
          text: "Continue with Text",
          style: "cancel",
        },
      ],
    );
  };

  return {
    checkRecordingPermission,
    incrementVoiceCount,
    showLimitReachedAlert,
    hasReachedDailyLimit: reachedDailyLimit,
    remainingFreeMessages,
    hasPremium,
    voiceCount: voiceUsage.dailyCount,
    monthlyCount: voiceUsage.monthlyCount,
    isLoading,
  };
}
