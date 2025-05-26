import { Communication } from "@medplum/fhirtypes";
import { useMedplum } from "@medplum/react-hooks";
import * as React from "react";
import { Platform, Pressable, ScrollView, StyleSheet } from "react-native";

import { useSubscription } from "../contexts/SubscriptionContext";
import { Box, Button, Divider, Heading, HStack, Text, VStack } from "./ui";

/**
 * Debug panel component for RevenueCat subscription testing
 * This component provides buttons to trigger various debugging actions for RevenueCat
 */
const SubscriptionDebugPanel = () => {
  const { customerInfo, isPremium, debugGetCustomerInfo, debugGetOfferings, debugRefreshUI } =
    useSubscription();
  const medplum = useMedplum();
  const [logs, setLogs] = React.useState<Communication[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState<boolean>(false);
  const [expandedLogs, setExpandedLogs] = React.useState<Record<string, boolean>>({});
  const [showLogs, setShowLogs] = React.useState<boolean>(false);

  // Load logs when requested
  const loadLogs = React.useCallback(async () => {
    if (!medplum) return;

    setLoadingLogs(true);
    try {
      const profile = medplum.getProfile();
      if (!profile?.id) {
        console.log("No profile found. Please log in.");
        setLoadingLogs(false);
        return;
      }

      console.log("Loading RevenueCat logs...");
      // Search for all Communication resources that have RevenueCat in the content
      const searchResult = await medplum.search("Communication", {
        _count: 30,
        _sort: "-_lastUpdated",
        subject: `Patient/${profile.id}`,
        "payload-content-string": "RevenueCat",
      });

      const communications =
        searchResult.resourceType === "Bundle"
          ? searchResult.entry?.map((entry) => entry.resource as Communication) || []
          : [];

      console.log(`Found ${communications.length} RevenueCat log entries`);
      setLogs(communications);
    } catch (err) {
      console.error("Failed to load subscription logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [medplum]);

  // Toggle expanded state for a log
  const toggleExpand = (id: string) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Format the timestamp from the log payload
  const getTimestamp = (log: Communication): string => {
    try {
      if (log.payload && log.payload.length > 1) {
        const payloadJson = log.payload[1]?.contentString;
        if (payloadJson) {
          const data = JSON.parse(payloadJson);
          return data.timestamp || log.sent || "Unknown";
        }
      }
      return log.sent || "Unknown";
    } catch (e) {
      return log.sent || "Unknown";
    }
  };

  // Get title from the log
  const getTitle = (log: Communication): string => {
    return log.payload?.[0]?.contentString || "No title";
  };

  // Get content from the log payload
  const getContent = (log: Communication): string => {
    try {
      if (log.payload && log.payload.length > 1) {
        const payloadJson = log.payload[1]?.contentString;
        if (payloadJson) {
          const data = JSON.parse(payloadJson);
          return JSON.stringify(data, null, 2);
        }
      }
      return "No content";
    } catch (e) {
      return "Error parsing content";
    }
  };

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

        <HStack className="items-center justify-between">
          <Text className="font-bold">Customer ID:</Text>
          <Text numberOfLines={1} ellipsizeMode="middle" maxWidth="60%">
            {/* Show current app user ID instead of original anonymous ID */}
            {(() => {
              // We need to get the current app user ID, not the original
              // The originalAppUserId is the anonymous ID (correct for RevenueCat)
              // But we want to show the current Patient ID to users
              return "Current: Patient ID (check logs for actual ID)";
            })()}
          </Text>
        </HStack>

        <HStack className="items-center justify-between">
          <Text className="font-bold">Premium Status:</Text>
          <Text className={isPremium ? "text-green-600" : "text-gray-600"}>
            {isPremium ? "Active" : "Inactive"}
          </Text>
        </HStack>

        {customerInfo?.entitlements?.active &&
          Object.keys(customerInfo.entitlements.active).length > 0 && (
            <VStack className="gap-1">
              <Text className="font-bold">Active Entitlements:</Text>
              {Object.keys(customerInfo.entitlements.active).map((key) => (
                <Text key={key} className="text-xs">
                  {key}: Active entitlement
                </Text>
              ))}
            </VStack>
          )}

        <Divider className="my-1" />

        <Button size="sm" variant="outline" onPress={debugGetCustomerInfo} className="mb-1">
          <Text className="text-xs">Refresh Customer Info</Text>
        </Button>

        <Button size="sm" variant="outline" onPress={debugGetOfferings} className="mb-1">
          <Text className="text-xs">Refresh Offerings</Text>
        </Button>

        <Button size="sm" variant="outline" onPress={debugRefreshUI} className="mb-1">
          <Text className="text-xs">Refresh Debug UI Overlay</Text>
        </Button>

        <Button
          size="sm"
          variant="solid"
          onPress={async () => {
            setShowLogs(!showLogs);
            if (!showLogs) {
              await loadLogs();
            }
          }}
          className="mb-1"
        >
          <Text className="text-xs text-white">{showLogs ? "Hide" : "Show"} RevenueCat Logs</Text>
        </Button>

        {showLogs && (
          <Box className="mt-2 max-h-96">
            <Heading size="xs" className="mb-2 text-gray-700">
              RevenueCat Logs
            </Heading>

            {loadingLogs ? (
              <Text className="text-xs text-gray-500">Loading logs...</Text>
            ) : logs.length === 0 ? (
              <Text className="text-xs text-gray-500">No logs found.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 350 }}>
                <VStack className="gap-2">
                  {logs.map((log) => (
                    <Pressable
                      key={log.id}
                      onPress={() => toggleExpand(log.id || "")}
                      style={styles.logItem}
                    >
                      <Text className="text-xs font-bold">{getTitle(log)}</Text>
                      <Text className="text-[10px] text-gray-500">{getTimestamp(log)}</Text>

                      {expandedLogs[log.id || ""] && (
                        <Box className="mt-1 rounded-md bg-gray-50 p-2">
                          <ScrollView style={{ maxHeight: 200 }}>
                            <Text className="font-mono text-[10px]">{getContent(log)}</Text>
                          </ScrollView>
                        </Box>
                      )}
                    </Pressable>
                  ))}
                </VStack>
              </ScrollView>
            )}

            <Button size="xs" variant="outline" onPress={loadLogs} className="mt-2">
              <Text className="text-[10px]">Refresh Logs</Text>
            </Button>
          </Box>
        )}

        <Text className="mt-2 text-center text-xs text-gray-500">
          Debug panel enabled for development builds
        </Text>
      </VStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  logItem: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#eaeaea",
  },
});

export default SubscriptionDebugPanel;
