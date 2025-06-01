import { useMedplum } from "@medplum/react-hooks";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import { useSubscription } from "../contexts/SubscriptionContext";
import { ENTITLEMENT_IDS } from "../utils/subscription/config";
import { trackSubscriptionEvent } from "../utils/system-logging";
import {
  FREE_DAILY_VOICE_MESSAGE_LIMIT,
  getVoiceMessageUsage,
  hasReachedDailyLimit,
  incrementVoiceMessageCount,
} from "../utils/voiceMessageTracking";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./Modal";
import { Button, ButtonText, Heading, Text, VStack } from "./ui";

interface VoiceMessageGateProps {
  threadId: string;
  onAllowRecording: () => void;
  onDenyRecording: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Component that gates voice recording functionality based on subscription status
 * and daily usage limits for free tier users
 */
export function VoiceMessageGate({
  threadId: _threadId,
  onAllowRecording,
  onDenyRecording,
  isOpen = false,
  onClose,
}: VoiceMessageGateProps) {
  // We use threadId for documentation but prefix with _ to indicate it's unused
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Use external isOpen prop if provided, otherwise use internal state
  const modalIsOpen = isOpen ?? showLimitModal;

  // Helper function to close modal (external or internal)
  const closeModal = () => {
    if (onClose) {
      onClose();
    } else {
      setShowLimitModal(false);
    }
  };
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

  // Helper function for logging to AuditEvent
  const logToAuditEvent = async (
    eventType: "purchase" | "status_change" | "error",
    title: string,
    data: Record<string, unknown>,
    success: boolean = true,
  ) => {
    try {
      const profile = medplum.getProfile();
      if (profile?.id) {
        await trackSubscriptionEvent({
          medplum,
          patientId: profile.id,
          eventType,
          details: `[VoiceMessageGate] ${title}: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            threadId: _threadId,
            ...data,
          })}`,
          success,
        });
      }
    } catch (error) {
      console.error(`Failed to log "${title}":`, error);
    }
  };

  // Direct paywall upgrade (better UX than going to subscription page)
  const handleDirectUpgrade = async () => {
    console.log("🛒 [VoiceGate] Upgrade button clicked - starting direct upgrade process");

    try {
      // Log upgrade attempt
      await logToAuditEvent("purchase", "VoiceGate Direct Upgrade Attempt", {
        currentUsage: voiceUsage,
        source: "voice_message_limit",
      });

      console.log("🛒 [VoiceGate] Closing modal first to avoid modal stacking issues");

      // Close the modal first to avoid modal stacking issues with RevenueCat paywall
      closeModal();

      // Small delay to ensure modal is fully closed before presenting paywall
      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log("🛒 [VoiceGate] About to present RevenueCat paywall for upgrade");

      // Present RevenueCat native paywall directly - matching SubscriptionScreen implementation exactly
      const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

      console.log("🛒 [VoiceGate] Paywall result received:", paywallResult);

      switch (paywallResult) {
        case PAYWALL_RESULT.PURCHASED:
          await logToAuditEvent("purchase", "VoiceGate Upgrade Success", {
            result: "purchased",
            source: "voice_message_limit",
          });
          console.log("🛒 [VoiceGate] Purchase successful, allowing recording");
          // Allow the recording since they just upgraded (modal already closed)
          onAllowRecording();
          break;

        case PAYWALL_RESULT.RESTORED:
          await logToAuditEvent("purchase", "VoiceGate Upgrade Success", {
            result: "restored",
            source: "voice_message_limit",
          });
          console.log("🛒 [VoiceGate] Purchases restored, allowing recording");
          // Allow the recording since they restored premium (modal already closed)
          onAllowRecording();
          break;

        case PAYWALL_RESULT.CANCELLED:
          await logToAuditEvent("status_change", "VoiceGate Upgrade Cancelled", {
            result: "cancelled",
            source: "voice_message_limit",
          });
          console.log("🛒 [VoiceGate] User cancelled paywall, re-opening modal");
          // Re-open the modal since user cancelled (only if using internal state)
          if (!onClose) {
            setShowLimitModal(true);
          }
          // Note: If using external control, parent should handle re-opening
          break;

        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        default:
          await logToAuditEvent(
            "error",
            "VoiceGate Upgrade Error",
            {
              result: paywallResult,
              resultString: String(paywallResult),
              source: "voice_message_limit",
            },
            false,
          );
          console.log("🛒 [VoiceGate] Paywall not presented or error:", paywallResult);
          console.log("🛒 [VoiceGate] Falling back to subscription page");
          // Fallback to subscription page if paywall fails (modal already closed)
          router.push("/subscription");
          break;
      }
    } catch (error) {
      console.error("🛒 [VoiceGate] Paywall exception caught:", error);
      console.error("🛒 [VoiceGate] Error type:", typeof error);
      console.error(
        "🛒 [VoiceGate] Error details:",
        error instanceof Error ? error.message : String(error),
      );

      await logToAuditEvent(
        "error",
        "VoiceGate Upgrade Exception",
        {
          result: "exception",
          error: error instanceof Error ? error.message : String(error),
          errorType: typeof error,
          source: "voice_message_limit",
        },
        false,
      );

      // Fallback to subscription page on error (modal already closed)
      console.log("🛒 [VoiceGate] Falling back to subscription page due to exception");
      router.push("/subscription");
    }
  };

  return (
    <Modal isOpen={modalIsOpen} onClose={closeModal}>
      <ModalHeader>
        <Heading size="lg">Voice Message Limit</Heading>
      </ModalHeader>
      <ModalBody>
        <VStack className="gap-4">
          <Text>
            You've used all {FREE_DAILY_VOICE_MESSAGE_LIMIT} of your daily voice messages.
          </Text>
          <Text>Upgrade to Voice Connect for enhanced voice messaging.</Text>
        </VStack>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onPress={closeModal} className="mr-2">
          <ButtonText>Continue with Text</ButtonText>
        </Button>
        <Button variant="solid" onPress={handleDirectUpgrade}>
          <ButtonText>Upgrade to Voice Connect</ButtonText>
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/**
 * Hook to use the voice message gate functionality
 * @param threadId Thread ID to count voice messages for
 * @returns Functions to check and handle voice recording permission
 */
export function useVoiceMessageGate(_threadId: string) {
  // _threadId is used in queries within fetchVoiceUsage function below
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
    isLoading: _isLoading,
  };
}
