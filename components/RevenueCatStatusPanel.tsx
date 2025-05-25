import { useMedplumContext } from "@medplum/react-hooks";
import React, { useEffect, useState } from "react";
import { Alert, NativeModules, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Purchases from "react-native-purchases";

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

  const attemptBridgeDiagnostic = () => {
    // Log initial attempt to Communication
    logToCommunication("Native Bridge Diagnostic Started", {
      platform: Platform.OS,
    });

    if (!NativeModules.RNPurchases) {
      const errorMsg = "RNPurchases native module is not available";
      Alert.alert("Native Module Error", errorMsg);
      logToCommunication("Native Module Error", { error: errorMsg });
      return;
    }

    const diagnosticInfo = {
      hasRNPurchases: !!NativeModules.RNPurchases,
      availableMethods: NativeModules.RNPurchases
        ? Object.getOwnPropertyNames(NativeModules.RNPurchases)
        : [],
      bridgeMethodCheck: {
        hasSetup: typeof NativeModules.RNPurchases?.setup === "function",
        hasSetupPurchases: typeof NativeModules.RNPurchases?.setupPurchases === "function",
        hasConfigure: typeof NativeModules.RNPurchases?.configure === "function",
        hasGetAppUserID: typeof NativeModules.RNPurchases?.getAppUserID === "function",
      },
      jsSDKMethods: {
        hasConfigure: typeof Purchases.configure === "function",
        hasIsConfigured: typeof Purchases.isConfigured === "function",
        hasGetAppUserID: typeof Purchases.getAppUserID === "function",
        hasLogIn: typeof Purchases.logIn === "function",
      },
      sdkVersion: Purchases?.VERSION || "unknown",
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };

    Alert.alert("Bridge Diagnostic", JSON.stringify(diagnosticInfo, null, 2));
    logToCommunication("Native Bridge Diagnostic Complete", diagnosticInfo);
  };

  const testUserLinking = async () => {
    try {
      const profile = medplum.getProfile();
      if (!profile?.id) {
        Alert.alert("User Linking Test", "No Medplum profile available for linking");
        return;
      }

      const currentUserID = await Purchases.getAppUserID();
      Alert.alert(
        "User Linking Test",
        `Current RevenueCat User ID: ${currentUserID}\nWill link to Patient ID: ${profile.id}`,
      );

      // Log the test attempt
      await logToCommunication("User Linking Test Started", {
        currentUserID,
        patientID: profile.id,
        platform: Platform.OS,
      });

      // Switch to Patient ID
      await Purchases.logIn(profile.id);

      // Invalidate cache to ensure fresh data
      await Purchases.invalidateCustomerInfoCache();

      // Wait for cache invalidation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get new user ID and customer info to confirm
      const newUserID = await Purchases.getAppUserID();
      const newCustomerInfo = await Purchases.getCustomerInfo();

      Alert.alert(
        "User Linking Test",
        `SUCCESS!\nPrevious ID: ${currentUserID}\nNew User ID: ${newUserID}\nCustomer ID: ${newCustomerInfo.originalAppUserId}`,
      );

      // Log success
      await logToCommunication("User Linking Test Success", {
        previousID: currentUserID,
        newID: newUserID,
        customerInfoID: newCustomerInfo.originalAppUserId,
        cacheInvalidated: true,
        platform: Platform.OS,
      });
    } catch (error) {
      Alert.alert("User Linking Test", `ERROR: ${error}`);

      await logToCommunication("User Linking Test Failed", {
        error: error instanceof Error ? error.message : String(error),
        platform: Platform.OS,
      });
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
          onPress={attemptBridgeDiagnostic}
        >
          <Text style={styles.buttonText}>Bridge Diagnostic</Text>
        </Pressable>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, { backgroundColor: "#4caf50" }]}
          onPress={testUserLinking}
        >
          <Text style={styles.buttonText}>Test User Linking</Text>
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
