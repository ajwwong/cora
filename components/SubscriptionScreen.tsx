import { useMedplum } from "@medplum/react-hooks";
import { useRouter } from "expo-router";
import * as React from "react";
import { useEffect } from "react";
import { Platform } from "react-native";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import { trackSubscriptionEvent } from "@/utils/system-logging";

import { useSubscription } from "../contexts/SubscriptionContext";
import { FREE_DAILY_VOICE_MESSAGE_LIMIT } from "../utils/subscription/config";
import LoadingScreen from "./LoadingScreen";
import SubscriptionDebugPanel from "./SubscriptionDebugPanel";
import { Box, Button, Divider, Heading, HStack, ScrollView, Text, VStack } from "./ui";
const { useState } = React;

/**
 * Component to display subscription plans and handle purchases
 */
const SubscriptionScreen = () => {
  const router = useRouter();
  const medplum = useMedplum();

  // Using RevenueCat native paywall instead of custom purchase state
  const {
    isLoading,
    availablePackages,
    isPremium,
    purchasePackage,
    restorePurchases,
    customerInfo,
  } = useSubscription();

  // Create a helper function for logging to AuditEvent resources
  const logToAuditEvent = async (
    eventType: "purchase" | "status_change" | "error",
    title: string,
    data: Record<string, unknown>,
    success: boolean = true,
  ) => {
    try {
      const profile = medplum.getProfile();
      if (!profile?.id) return;

      await trackSubscriptionEvent({
        medplum,
        patientId: profile.id,
        eventType,
        details: `[SubscriptionScreen] ${title}: ${JSON.stringify({
          timestamp: new Date().toISOString(),
          ...data,
        })}`,
        success,
      });
    } catch (error) {
      console.error(`Failed to log "${title}":`, error);
    }
  };

  // Log subscription status when component mounts
  useEffect(() => {
    const logSubscriptionInfo = async () => {
      await logToAuditEvent("status_change", "SubscriptionScreen Initial Status", {
        isPremium,
        hasCustomerInfo: !!customerInfo,
        activeEntitlements: customerInfo?.entitlements?.active
          ? Object.keys(customerInfo.entitlements.active)
          : [],
        customerInfoId: customerInfo?.originalAppUserId || null,
        hasPackages: !!availablePackages?.length,
        packageCount: availablePackages?.length || 0,
        status: isPremium ? "Voice Connect" : "Text Companion",
      });
    };

    logSubscriptionInfo();
  }, [isPremium, customerInfo, availablePackages, logToAuditEvent]);

  // Handle purchase using RevenueCat native paywall
  const handlePurchase = async () => {
    try {
      // Log purchase attempt
      await logToAuditEvent("purchase", "SubscriptionScreen PaywallUI Attempt", {
        currentStatus: isPremium ? "premium" : "free",
      });

      console.log("🛒 Presenting RevenueCat native paywall");

      // Present RevenueCat native paywall
      const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

      console.log("🛒 Paywall result:", paywallResult);

      switch (paywallResult) {
        case PAYWALL_RESULT.PURCHASED:
          await logToAuditEvent("purchase", "SubscriptionScreen PaywallUI Success", {
            result: "purchased",
            premium: true,
          });
          console.log("🛒 Purchase successful via paywall, navigating to main screen");
          router.push("/(app)");
          break;

        case PAYWALL_RESULT.RESTORED:
          await logToAuditEvent("purchase", "SubscriptionScreen PaywallUI Success", {
            result: "restored",
            premium: true,
          });
          console.log("🛒 Purchases restored via paywall, navigating to main screen");
          router.push("/(app)");
          break;

        case PAYWALL_RESULT.CANCELLED:
          await logToAuditEvent("status_change", "SubscriptionScreen PaywallUI Cancelled", {
            result: "cancelled",
          });
          console.log("🛒 User cancelled paywall");
          break;

        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        default:
          await logToAuditEvent(
            "error",
            "SubscriptionScreen PaywallUI Error",
            {
              result: paywallResult,
            },
            false,
          );
          console.log("🛒 Paywall error or not presented:", paywallResult);
          break;
      }
    } catch (error) {
      console.error("🛒 Paywall error:", error);

      await logToAuditEvent(
        "error",
        "SubscriptionScreen PaywallUI Exception",
        {
          result: "exception",
          error: error instanceof Error ? error.message : String(error),
        },
        false,
      );
    }
  };

  // Handle restore purchases
  const handleRestore = async () => {
    // Log restore attempt
    await logToAuditEvent("purchase", "SubscriptionScreen Restore Attempt", {
      currentStatus: isPremium ? "premium" : "free",
    });

    try {
      const success = await restorePurchases();

      if (success) {
        // Log restore success
        await logToAuditEvent("purchase", "SubscriptionScreen Restore Success", {
          result: "success",
          premium: true,
        });

        // Show success message or navigate to main screen
        router.push("/(app)");
      } else {
        // Log no purchases found
        await logToAuditEvent("status_change", "SubscriptionScreen Restore No Purchases", {
          result: "no_purchases",
          premium: isPremium,
        });

        // No purchases found to restore
        alert("No previous purchases were found.");
      }
    } catch (error) {
      console.error("Restore failed:", error);

      // Log restore error
      await logToAuditEvent(
        "error",
        "SubscriptionScreen Restore Error",
        {
          result: "error",
          error: error instanceof Error ? error.message : String(error),
        },
        false,
      );
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  // If user already has premium subscription
  if (isPremium) {
    return (
      <ScrollView flex={1} p={4} bg="bg-50">
        <VStack space={6} alignItems="center" pt={10} pb={20}>
          <Box
            w="70px"
            h="70px"
            borderRadius="full"
            bg="primary-100"
            alignItems="center"
            justifyContent="center"
            mb={4}
          >
            <Text fontSize="3xl" color="primary-900">
              ✓
            </Text>
          </Box>

          <Heading size="xl" textAlign="center">
            You're Subscribed!
          </Heading>

          <Text fontSize="md" textAlign="center" mb={2}>
            You have an active Voice Connect subscription with voice messaging.
          </Text>

          <Box
            w="100%"
            bg="white"
            p={6}
            borderRadius="xl"
            borderWidth={1}
            borderColor="gray-200"
            mt={4}
          >
            <Text fontWeight="bold" fontSize="lg" mb={2}>
              Voice Connect
            </Text>
            <Text mb={4}>Voice messaging</Text>
            <HStack alignItems="center">
              <Box w="14px" h="14px" borderRadius="full" bg="success-500" mr={2} />
              <Text color="success-700">Active subscription</Text>
            </HStack>
          </Box>

          <Button variant="outline" onPress={() => router.back()} w="100%" mt={6}>
            <Text color="primary-600">Return to Chat</Text>
          </Button>

          {/* Debug Panel */}
          <SubscriptionDebugPanel />
        </VStack>
      </ScrollView>
    );
  }

  // Main subscription screen (for non-subscribers)
  return (
    <ScrollView flex={1} p={4} bg="bg-50">
      <VStack space={6} pt={4} pb={20}>
        <Heading size="xl" textAlign="center" mb={2}>
          Voice Connect
        </Heading>

        <Text fontSize="md" textAlign="center" mb={4}>
          Upgrade to unlock voice messaging
        </Text>

        {/* Free tier info */}
        <Box bg="white" p={5} borderRadius="lg" borderWidth={1} borderColor="gray-200">
          <VStack space={2}>
            <Text fontSize="lg" fontWeight="bold">
              Text Companion
            </Text>
            <Text>Text-based conversations with your reflection guide</Text>
            <Text mb={1}>Up to {FREE_DAILY_VOICE_MESSAGE_LIMIT} voice messages per day</Text>
            <HStack alignItems="baseline">
              <Text fontSize="xl" fontWeight="bold">
                Free
              </Text>
            </HStack>
            <Text fontSize="sm" fontWeight="medium" color="success-600" mt={1}>
              Your current plan
            </Text>
          </VStack>
        </Box>

        <Divider my={2} />

        {/* Premium packages */}
        <VStack space={4}>
          {availablePackages?.map((pkg, index) => (
            <Box
              key={pkg.identifier}
              bg="white"
              p={5}
              borderRadius="lg"
              borderWidth={1}
              borderColor="primary-300"
            >
              <VStack space={3}>
                <Text fontSize="lg" fontWeight="bold">
                  {pkg.product.title || "Voice Connect"}
                </Text>
                <Text>
                  {pkg.product.description || "Voice messaging with your reflection guide"}
                </Text>
                <HStack alignItems="baseline">
                  <Text fontSize="xl" fontWeight="bold">
                    {pkg.product.priceString}
                  </Text>
                  <Text fontSize="sm" ml={1} color="gray-600">
                    {pkg.packageType === "ANNUAL" ? "/year" : "/month"}
                  </Text>
                </HStack>
                {pkg.packageType === "ANNUAL" && (
                  <Text fontSize="sm" color="success-600">
                    Save with annual billing
                  </Text>
                )}
                <Button onPress={handlePurchase} mt={2}>
                  <Text color="white">Subscribe</Text>
                </Button>
              </VStack>
            </Box>
          ))}

          {/* Show message if no packages available */}
          {(!availablePackages || availablePackages.length === 0) && (
            <Box p={4} bg="gray-100" borderRadius="md">
              <Text textAlign="center">No subscription plans are currently available.</Text>
            </Box>
          )}
        </VStack>

        {/* Restore purchases button */}
        <Button variant="outline" onPress={handleRestore} mt={2}>
          <Text color="primary-600">Restore Purchases</Text>
        </Button>

        <Text fontSize="xs" textAlign="center" color="gray-500" mt={4}>
          Payment will be charged to your {Platform.OS === "ios" ? "Apple ID" : "Google Play"}{" "}
          account at confirmation of purchase. Subscription automatically renews unless it is
          canceled at least 24 hours before the end of the current period. Your account will be
          charged for renewal within 24 hours prior to the end of the current period. Manage or
          cancel your subscription in your {Platform.OS === "ios" ? "App Store" : "Google Play"}{" "}
          settings.
        </Text>

        {/* Debug Panel */}
        <SubscriptionDebugPanel />
      </VStack>
    </ScrollView>
  );
};

export default SubscriptionScreen;
