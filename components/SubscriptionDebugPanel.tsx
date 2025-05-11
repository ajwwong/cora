import * as React from "react";
import { Platform } from "react-native";

import { useSubscription } from "../contexts/SubscriptionContext";
import { Box, Button, Divider, Heading, HStack, Text, VStack } from "./ui";

/**
 * Debug panel component for RevenueCat subscription testing
 * This component provides buttons to trigger various debugging actions for RevenueCat
 */
const SubscriptionDebugPanel = () => {
  const { customerInfo, isPremium, debugGetCustomerInfo, debugGetOfferings, debugRefreshUI } =
    useSubscription();

  if (Platform.OS === "web") {
    return (
      <Box mt={4} p={4} bg="gray-100" borderRadius="md">
        <Text textAlign="center">Debug panel not available on web platform.</Text>
      </Box>
    );
  }

  return (
    <Box mt={4} p={4} bg="gray-100" borderRadius="md" borderWidth={1} borderColor="gray-300">
      <VStack space={3}>
        <Heading size="sm" color="gray-700">
          RevenueCat Debug Tools
        </Heading>

        <Divider />

        <HStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="bold">Customer ID:</Text>
          <Text numberOfLines={1} ellipsizeMode="middle" maxWidth="60%">
            {customerInfo?.originalAppUserId || "Not set"}
          </Text>
        </HStack>

        <HStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="bold">Premium Status:</Text>
          <Text color={isPremium ? "success-600" : "gray-600"}>
            {isPremium ? "Active" : "Inactive"}
          </Text>
        </HStack>

        {customerInfo?.entitlements?.active &&
          Object.keys(customerInfo.entitlements.active).length > 0 && (
            <VStack space={1}>
              <Text fontWeight="bold">Active Entitlements:</Text>
              {Object.keys(customerInfo.entitlements.active).map((key) => (
                <Text key={key} fontSize="xs">
                  {key}: {customerInfo.entitlements.active[key]?.expiresDate || "No expiration"}
                </Text>
              ))}
            </VStack>
          )}

        <Divider my={1} />

        <Button size="sm" variant="outline" onPress={debugGetCustomerInfo} mb={1}>
          <Text fontSize="xs">Refresh Customer Info</Text>
        </Button>

        <Button size="sm" variant="outline" onPress={debugGetOfferings} mb={1}>
          <Text fontSize="xs">Refresh Offerings</Text>
        </Button>

        <Button size="sm" variant="outline" onPress={debugRefreshUI}>
          <Text fontSize="xs">Refresh Debug UI Overlay</Text>
        </Button>

        <Text color="gray-500" fontSize="xs" textAlign="center" mt={2}>
          Debug panel enabled for development builds
        </Text>
      </VStack>
    </Box>
  );
};

export default SubscriptionDebugPanel;
