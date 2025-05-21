import { useMedplumContext } from "@medplum/react-hooks";
import React, { useEffect, useState } from "react";
import { Alert, NativeModules, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { getRevenueCatDebugInfo } from "@/utils/subscription/initialize-revenue-cat";

interface StatusProps {
  onClose?: () => void;
}

/**
 * A simple status panel that can be shown in the app to display the current status of RevenueCat
 * This is useful for debugging and understanding the current state
 */
export const RevenueCatStatusPanel: React.FC<StatusProps> = ({ onClose }) => {
  const { medplum } = useMedplumContext();
  const [debugInfo, setDebugInfo] = useState(getRevenueCatDebugInfo());

  // Helper function to log panel actions to Communication resources
  const logToCommunication = async (title: string, data: Record<string, unknown>) => {
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
            contentString: `PANEL: ${title}`,
          },
          {
            contentString: JSON.stringify({
              timestamp: new Date().toISOString(),
              ...data,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(`Failed to log "${title}" from panel:`, error);
    }
  };

  useEffect(() => {
    // Refresh debug info every second
    const interval = setInterval(() => {
      setDebugInfo(getRevenueCatDebugInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const showDetailedInfo = () => {
    // Enhanced debug info
    const enhancedInfo = {
      ...debugInfo,
      nativeModuleCheck: {
        hasRNPurchases: !!NativeModules.RNPurchases,
        methods: NativeModules.RNPurchases
          ? Object.getOwnPropertyNames(NativeModules.RNPurchases)
          : "none",
        allModules: Object.keys(NativeModules),
      },
    };

    // Show alert
    Alert.alert("RevenueCat Detailed Status", JSON.stringify(enhancedInfo, null, 2));

    // Log to Communication resources
    logToCommunication("Detailed Status Button Pressed", enhancedInfo);
  };

  const attemptDirectNativeCall = () => {
    // Log initial attempt to Communication
    logToCommunication("Native Module Call Attempt", {
      hasRNPurchases: !!NativeModules.RNPurchases,
      methods: NativeModules.RNPurchases
        ? Object.getOwnPropertyNames(NativeModules.RNPurchases)
        : "none",
      platform: Platform.OS,
    });

    if (!NativeModules.RNPurchases) {
      const errorMsg = "RNPurchases native module is not available";
      Alert.alert("Native Module Error", errorMsg);
      logToCommunication("Native Module Error", { error: errorMsg });
      return;
    }

    try {
      // Try to call a method directly on the native module
      if (typeof NativeModules.RNPurchases.setup === "function") {
        // This is a direct call to the native module, bypassing the JS wrapper
        const apiKey =
          Platform.OS === "ios"
            ? "appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            : "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo";

        const message = "Attempting direct setup call...";
        Alert.alert("Native Module", message);
        logToCommunication("Native Module Setup", {
          message,
          apiKeyPrefix: apiKey.substring(0, 6) + "...",
        });

        NativeModules.RNPurchases.setup(
          apiKey,
          null, // appUserID
          true, // observerMode
          {}, // userDefaultsSuiteName
          () => {
            const successMsg = "Native module setup succeeded";
            Alert.alert("Setup Success", successMsg);
            logToCommunication("Native Module Setup Success", { message: successMsg });
          },
          (error: string) => {
            Alert.alert("Setup Error", error);
            logToCommunication("Native Module Setup Error", { error });
          },
        );
      } else {
        const errorMsg = "setup method not available on RNPurchases";
        Alert.alert("Native Method Error", errorMsg);
        logToCommunication("Native Method Error", {
          error: errorMsg,
          availableMethods: NativeModules.RNPurchases
            ? Object.getOwnPropertyNames(NativeModules.RNPurchases)
            : "none",
        });
      }
    } catch (error) {
      const errorMsg = String(error);
      Alert.alert("Native Call Error", errorMsg);
      logToCommunication("Native Call Error", { error: errorMsg });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RevenueCat Status</Text>

      <View style={styles.row}>
        <Text style={styles.label}>SDK Initialized:</Text>
        <Text style={debugInfo.isInitialized ? styles.valueSuccess : styles.valueError}>
          {debugInfo.isInitialized ? "YES ✅" : "NO ❌"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Attempts Made:</Text>
        <Text style={styles.value}>{debugInfo.initializationAttempted ? "YES" : "NO"}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>isConfigured():</Text>
        <Text style={debugInfo.isConfigured ? styles.valueSuccess : styles.valueError}>
          {debugInfo.isConfigured === undefined
            ? "N/A"
            : debugInfo.isConfigured
              ? "YES ✅"
              : "NO ❌"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Platform:</Text>
        <Text style={styles.value}>{Platform.OS}</Text>
      </View>

      {debugInfo.lastError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorLabel}>Last Error:</Text>
          <Text style={styles.errorText}>{debugInfo.lastError}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={showDetailedInfo}>
          <Text style={styles.buttonText}>Detailed Info</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: "#ff9800" }]}
          onPress={attemptDirectNativeCall}
        >
          <Text style={styles.buttonText}>Try Native Call</Text>
        </Pressable>

        {onClose && (
          <Pressable style={[styles.button, styles.closeButton]} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 16,
    borderRadius: 8,
    width: "90%",
    alignSelf: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    color: "#ccc",
    fontSize: 14,
  },
  value: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  valueSuccess: {
    color: "#4caf50",
    fontSize: 14,
    fontWeight: "bold",
  },
  valueError: {
    color: "#f44336",
    fontSize: 14,
    fontWeight: "bold",
  },
  errorContainer: {
    marginTop: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    borderRadius: 4,
  },
  errorLabel: {
    color: "#f44336",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  errorText: {
    color: "#ffcdd2",
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  button: {
    backgroundColor: "#2196f3",
    padding: 8,
    borderRadius: 4,
    flex: 1,
    alignItems: "center",
    marginHorizontal: 4,
  },
  closeButton: {
    backgroundColor: "#757575",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
