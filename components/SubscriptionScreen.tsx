import { useMedplum } from "@medplum/react-hooks";
import { useRouter } from "expo-router";
import * as React from "react";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useSubscription } from "../contexts/SubscriptionContext";
import { FREE_DAILY_VOICE_MESSAGE_LIMIT } from "../utils/subscription/config";
import LoadingScreen from "./LoadingScreen";
import SubscriptionDebugPanel from "./SubscriptionDebugPanel";
import { Box, Button, Divider, Heading, HStack, ScrollView, Text, VStack } from "./ui";
// Directly access useState from React object as a fallback in case of import issues
// This is needed for specific React Native handling, not a typical pattern
const useState =
  React.useState ||
  function (initialState: unknown) {
    return [initialState, () => {}];
  };

/**
 * Component to display subscription plans and handle purchases
 */
const SubscriptionScreen = () => {
  const router = useRouter();
  const medplum = useMedplum();

  let purchaseInProgress = false;
  let setPurchaseInProgress = (value: boolean) => {
    purchaseInProgress = value;
  };

  try {
    // Try-catch around useState to prevent "displayName" error
    const [purchaseInProgressState, setPurchaseInProgressState] = useState(false);
    purchaseInProgress = purchaseInProgressState;
    setPurchaseInProgress = setPurchaseInProgressState;
  } catch (error) {
    console.warn("Error initializing state in SubscriptionScreen:", error);
  }
  const {
    isLoading,
    availablePackages,
    isPremium,
    purchasePackage,
    restorePurchases,
    customerInfo,
  } = useSubscription();

  // Create a helper function for logging to Communication resources
  const logToMedplum = async (title: string, data: Record<string, unknown>) => {
    try {
      const profile = medplum.getProfile();
      if (!profile?.id) return;

      await medplum.createResource({
        resourceType: "Communication",
        status: "completed",
        subject: { reference: `Patient/${profile.id}` },
        about: [{ reference: `Patient/${profile.id}` }],
        sent: new Date().toISOString(),
        payload: [
          {
            contentString: title,
          },
          {
            contentString: JSON.stringify({
              timestamp: new Date().toISOString(),
              component: "SubscriptionScreen",
              ...data,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(`Failed to log "${title}":`, error);
    }
  };

  // Log subscription status when component mounts
  useEffect(() => {
    const logSubscriptionInfo = async () => {
      await logToMedplum("SubscriptionScreen Initial Status", {
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
  }, [isPremium, customerInfo, availablePackages, logToMedplum]);

  // Handle package purchase
  const handlePurchase = async (packageIndex: number) => {
    if (!availablePackages || availablePackages.length <= packageIndex) return;

    const selectedPackage = availablePackages[packageIndex];

    // Log purchase attempt
    await logToMedplum("SubscriptionScreen Purchase Attempt", {
      packageIdentifier: selectedPackage.identifier,
      packageType: selectedPackage.packageType,
      productIdentifier: selectedPackage.product.identifier,
      price: selectedPackage.product.price,
      priceString: selectedPackage.product.priceString,
      currentStatus: isPremium ? "premium" : "free",
    });

    try {
      setPurchaseInProgress(true);
      const success = await purchasePackage(selectedPackage);

      if (success) {
        // Log purchase success
        await logToMedplum("SubscriptionScreen Purchase Success", {
          packageIdentifier: selectedPackage.identifier,
          result: "success",
          premium: true,
        });

        // Show success message or navigate back
        router.back();
      } else {
        // Log purchase failure
        await logToMedplum("SubscriptionScreen Purchase Failure", {
          packageIdentifier: selectedPackage.identifier,
          result: "failed",
          reason: "purchase operation returned false",
        });
      }
    } catch (error) {
      console.error("Purchase failed:", error);

      // Log purchase error
      await logToMedplum("SubscriptionScreen Purchase Error", {
        packageIdentifier: selectedPackage.identifier,
        result: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPurchaseInProgress(false);
    }
  };

  // Handle restore purchases
  const handleRestore = async () => {
    // Log restore attempt
    await logToMedplum("SubscriptionScreen Restore Attempt", {
      currentStatus: isPremium ? "premium" : "free",
    });

    try {
      setPurchaseInProgress(true);
      const success = await restorePurchases();

      if (success) {
        // Log restore success
        await logToMedplum("SubscriptionScreen Restore Success", {
          result: "success",
          premium: true,
        });

        // Show success message or navigate back
        router.back();
      } else {
        // Log no purchases found
        await logToMedplum("SubscriptionScreen Restore No Purchases", {
          result: "no_purchases",
          premium: isPremium,
        });

        // No purchases found to restore
        alert("No previous purchases were found.");
      }
    } catch (error) {
      console.error("Restore failed:", error);

      // Log restore error
      await logToMedplum("SubscriptionScreen Restore Error", {
        result: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPurchaseInProgress(false);
    }
  };

  if (isLoading || purchaseInProgress) {
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
                <Button onPress={() => handlePurchase(index)} mt={2}>
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
