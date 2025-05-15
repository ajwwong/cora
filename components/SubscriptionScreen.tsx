import { useRouter } from "expo-router";
import * as React from "react";
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
  const { isLoading, availablePackages, isPremium, purchasePackage, restorePurchases } =
    useSubscription();

  // Handle package purchase
  const handlePurchase = async (packageIndex: number) => {
    if (!availablePackages || availablePackages.length <= packageIndex) return;

    try {
      setPurchaseInProgress(true);
      const success = await purchasePackage(availablePackages[packageIndex]);

      if (success) {
        // Show success message or navigate back
        router.back();
      }
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setPurchaseInProgress(false);
    }
  };

  // Handle restore purchases
  const handleRestore = async () => {
    try {
      setPurchaseInProgress(true);
      const success = await restorePurchases();

      if (success) {
        // Show success message or navigate back
        router.back();
      } else {
        // No purchases found to restore
        alert("No previous purchases were found.");
      }
    } catch (error) {
      console.error("Restore failed:", error);
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
