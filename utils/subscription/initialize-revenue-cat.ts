/**
 * RevenueCat initialization utility
 * This file provides a function to initialize RevenueCat properly before usage
 * with extensive logging and UI alerts
 */

import { MedplumClient } from "@medplum/core";
import { Alert, Platform, ToastAndroid } from "react-native";
import Purchases from "react-native-purchases";

import { REVENUE_CAT_API_KEYS } from "./config";

let isInitialized = false;
let initializationAttempted = false;
const lastError: string | null = null;

// Make initialization status available globally
export const revenueCatStatus = {
  isInitialized,
  initializationAttempted,
  lastError,
  lastAttemptTime: new Date().toISOString(),
};

/**
 * Show a visible message to the user on any platform and log to Communication resources
 */
const showVisibleMessage = async (
  title: string,
  message: string,
  isError = false,
  medplumClient: MedplumClient | null = null,
) => {
  // Always show an alert for visibility
  if (Platform.OS === "android") {
    // On Android use both Toast and Alert for better visibility
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    Alert.alert(title, message);
  } else {
    // On iOS just use Alert
    Alert.alert(title, message);
  }

  // Also log to console
  if (isError) {
    console.error(`📱 [RevenueCat] ${title}: ${message}`);
  } else {
    console.log(`📱 [RevenueCat] ${title}: ${message}`);
  }

  // Update global status
  revenueCatStatus.lastAttemptTime = new Date().toISOString();
  if (isError) {
    revenueCatStatus.lastError = message;
  }

  // Also log to Communication resources if available
  if (medplumClient) {
    try {
      const profile = medplumClient.getProfile();
      if (profile?.id) {
        await medplumClient.createResource({
          resourceType: "Communication",
          status: "completed",
          subject: { reference: `Patient/${profile.id}` },
          about: [{ reference: `Patient/${profile.id}` }],
          sent: new Date().toISOString(),
          payload: [
            {
              contentString: `ALERT: ${title}`,
            },
            {
              contentString: JSON.stringify({
                timestamp: new Date().toISOString(),
                message,
                isError,
                platform: Platform.OS,
                environment: __DEV__ ? "development" : "production",
              }),
            },
          ],
        });
      }
    } catch (error) {
      console.error(`Failed to log alert "${title}" to Communication:`, error);
    }
  }
};

/**
 * Log to Communication resources for better debugging
 * This won't work before Medplum login, so we use visible alerts as a fallback
 */
const logToCommunication = async (
  medplum: MedplumClient | null,
  title: string,
  data: Record<string, unknown>,
) => {
  if (!medplum) return;

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
            ...data,
          }),
        },
      ],
    });
  } catch (error) {
    console.error(`Failed to log "${title}":`, error);
  }
};

/**
 * Get detailed information about the current status of RevenueCat
 * This is useful for debugging and understanding the current state
 */
export const getRevenueCatDebugInfo = (): Record<string, unknown> => {
  try {
    const info: Record<string, unknown> = {
      isInitialized,
      initializationAttempted,
      lastError,
      lastAttemptTime: revenueCatStatus.lastAttemptTime,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      purchasesType: typeof Purchases,
      purchasesAvailable: typeof Purchases !== "undefined" && Purchases !== null,
    };

    // Add additional info if Purchases is available
    if (info.purchasesAvailable) {
      info.purchasesVersion = Purchases.VERSION || "unknown";
      info.availableMethods = Object.keys(Purchases).filter(
        (key) => typeof Purchases[key as keyof typeof Purchases] === "function",
      );

      // Check if configured
      if (typeof Purchases.isConfigured === "function") {
        try {
          info.isConfigured = Purchases.isConfigured();
        } catch (e) {
          info.isConfiguredError = String(e);
        }
      } else {
        info.isConfiguredAvailable = false;
      }
    }

    return info;
  } catch (error) {
    return {
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Initialize RevenueCat SDK with very clear UI feedback
 * This should be called as early as possible in the app lifecycle
 * @param medplum - MedplumClient for logging (optional)
 * @returns true if initialized successfully, false otherwise
 */
export const initializeRevenueCat = async (
  medplum: MedplumClient | null = null,
): Promise<boolean> => {
  // Update status
  initializationAttempted = true;
  revenueCatStatus.initializationAttempted = true;

  // Skip for web platform
  if (Platform.OS === "web") {
    const message = "Web platform detected, skipping RevenueCat initialization";
    await showVisibleMessage("RevenueCat Info", message, false, medplum);

    await logToCommunication(medplum, "RevenueCat initialization skipped", {
      platform: "web",
      environment: __DEV__ ? "development" : "production",
    });

    return false;
  }

  // Don't initialize multiple times
  if (isInitialized) {
    const message = "RevenueCat already initialized, skipping";
    showVisibleMessage("RevenueCat Info", message);

    await logToCommunication(medplum, "RevenueCat already initialized", {
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
    });

    return true;
  }

  // Show a notification that initialization is starting
  showVisibleMessage("RevenueCat", "Starting initialization...");

  // Log initialization attempt
  await logToCommunication(medplum, "RevenueCat initialization starting", {
    platform: Platform.OS,
    environment: __DEV__ ? "development" : "production",
    purchasesType: typeof Purchases,
    purchasesVersion: Purchases?.VERSION || "unknown",
  });

  try {
    // Wait a short moment to ensure native module is registered
    // This helps with timing issues between native and JS
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify Purchases object is available
    if (typeof Purchases === "undefined" || Purchases === null) {
      const message = "RevenueCat SDK is not available";
      showVisibleMessage("RevenueCat Error", message, true);

      await logToCommunication(medplum, "RevenueCat SDK not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        purchasesType: typeof Purchases,
      });

      return false;
    }

    // Gather diagnostic info about the Purchases object
    const purchasesType = typeof Purchases;
    const hasConfigureMethod = typeof Purchases.configure === "function";
    const hasIsConfiguredMethod = typeof Purchases.isConfigured === "function";

    await logToCommunication(medplum, "RevenueCat Initialization Check", {
      purchasesType,
      hasConfigureMethod,
      hasIsConfiguredMethod,
      platform: Platform.OS,
    });

    // Verify configure method is available
    if (!hasConfigureMethod) {
      const message = "RevenueCat configure method is not available";
      showVisibleMessage("RevenueCat Error", message, true);

      await logToCommunication(medplum, "RevenueCat configure method not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        availableMethods: typeof Purchases === "object" ? Object.keys(Purchases).join(",") : "none",
      });

      return false;
    }

    // First check if already configured by native side
    let configuredSuccessfully = false;
    let nativelyConfigured = false;

    try {
      if (hasIsConfiguredMethod) {
        configuredSuccessfully = Purchases.isConfigured();

        if (configuredSuccessfully) {
          showVisibleMessage("RevenueCat", "Already configured by native module");
          nativelyConfigured = true;

          // Verify with a method call
          try {
            if (typeof Purchases.getAppUserID === "function") {
              const appUserId = await Purchases.getAppUserID();
              showVisibleMessage("RevenueCat", `Verified with getAppUserID: ${appUserId}`);

              // Everything is working - mark as initialized
              isInitialized = true;
              revenueCatStatus.isInitialized = true;

              await logToCommunication(medplum, "RevenueCat already configured by native module", {
                platform: Platform.OS,
                environment: __DEV__ ? "development" : "production",
                appUserId,
              });

              return true;
            }
          } catch (verifyError) {
            showVisibleMessage(
              "RevenueCat Warning",
              `isConfigured() returns true but verification failed: ${verifyError}`,
              true,
            );

            await logToCommunication(
              medplum,
              "RevenueCat isConfigured() returns true but verification failed",
              {
                platform: Platform.OS,
                environment: __DEV__ ? "development" : "production",
                error: verifyError instanceof Error ? verifyError.message : String(verifyError),
              },
            );

            // Continue with JS configuration as fallback
            nativelyConfigured = false;
            configuredSuccessfully = false;
          }
        }
      }
    } catch (configError) {
      showVisibleMessage(
        "RevenueCat Error",
        `Error checking configuration status: ${configError}, will attempt JS configuration`,
      );

      await logToCommunication(medplum, "Error checking RevenueCat configuration", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        error: configError instanceof Error ? configError.message : String(configError),
      });

      configuredSuccessfully = false;
      nativelyConfigured = false;
    }

    // If not already configured by native module, proceed with JS configuration
    if (!nativelyConfigured) {
      showVisibleMessage(
        "RevenueCat",
        "Not configured by native module, proceeding with JS initialization",
      );

      // Get the appropriate API key for the platform
      const apiKey =
        Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;

      // Set verbose logging in development BEFORE configuration
      if (__DEV__ && typeof Purchases.setLogLevel === "function") {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
      }

      try {
        // Configure RevenueCat from JS
        Purchases.configure({ apiKey });
        showVisibleMessage("RevenueCat", "Configured from JavaScript");

        // Verify configuration worked with a method call
        try {
          if (typeof Purchases.getAppUserID === "function") {
            const appUserId = await Purchases.getAppUserID();
            showVisibleMessage("RevenueCat", `Verified with getAppUserID: ${appUserId}`);

            configuredSuccessfully = true;
            isInitialized = true;
            revenueCatStatus.isInitialized = true;

            await logToCommunication(medplum, "RevenueCat JS configuration successful", {
              platform: Platform.OS,
              environment: __DEV__ ? "development" : "production",
              appUserId,
            });

            return true;
          }
        } catch (verifyError) {
          showVisibleMessage(
            "RevenueCat Error",
            `Verification failed after JS configuration: ${verifyError}`,
            true,
          );

          await logToCommunication(medplum, "RevenueCat verification failed after JS configure", {
            platform: Platform.OS,
            environment: __DEV__ ? "development" : "production",
            error: String(verifyError),
          });

          return false;
        }
      } catch (configError) {
        showVisibleMessage("RevenueCat Error", `JS configuration failed: ${configError}`, true);

        await logToCommunication(medplum, "RevenueCat JS configuration failed", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          error: configError instanceof Error ? configError.message : String(configError),
        });

        return false;
      }
    }

    // If we get here but initialization is still not detected, return false
    if (!isInitialized) {
      showVisibleMessage(
        "RevenueCat Error",
        "Initialization process completed but status checks failed",
        true,
      );
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    showVisibleMessage("RevenueCat Error", `Initialization failed: ${errorMessage}`, true);

    await logToCommunication(medplum, "RevenueCat initialization failed", {
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
      error: errorMessage,
    });

    return false;
  }
};

/**
 * Ensure RevenueCat is initialized before performing operations
 * @param medplum - MedplumClient for logging (optional)
 * @param showAlerts - Whether to show alerts (default: true)
 * @returns true if initialized successfully, false otherwise
 */
export const ensureRevenueCatInitialized = async (
  medplum: MedplumClient | null = null,
  showAlerts = true,
): Promise<boolean> => {
  // If already initialized, return true
  if (isInitialized) return true;

  if (showAlerts) {
    Alert.alert("RevenueCat", "Checking initialization status...");
  }

  // Do more rigorous verification with isConfigured AND method calls
  try {
    let configuredSuccessfully = false;

    // Check isConfigured first
    if (typeof Purchases.isConfigured === "function") {
      try {
        configuredSuccessfully = Purchases.isConfigured();

        if (showAlerts) {
          Alert.alert("RevenueCat Check", `isConfigured() returned: ${configuredSuccessfully}`);
        }
      } catch (configError) {
        if (showAlerts) {
          Alert.alert("RevenueCat Error", `Error calling isConfigured(): ${configError}`);
        }

        configuredSuccessfully = false;

        await logToCommunication(medplum, "Error calling isConfigured()", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          error: configError instanceof Error ? configError.message : String(configError),
        });
      }
    } else {
      if (showAlerts) {
        Alert.alert("RevenueCat Info", "isConfigured() method not available, trying other methods");
      }

      await logToCommunication(medplum, "isConfigured() method not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
      });
    }

    // IMPORTANT: Even if isConfigured() returns true, verify with a method call
    if (typeof Purchases.getAppUserID === "function") {
      try {
        const appUserId = await Purchases.getAppUserID();

        if (showAlerts) {
          Alert.alert("RevenueCat Verification", `Verified with getAppUserID: ${appUserId}`);
        }

        // If this succeeds, it's definitely configured
        configuredSuccessfully = true;

        await logToCommunication(medplum, "RevenueCat verified with getAppUserID", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          appUserId,
        });

        isInitialized = true;
        revenueCatStatus.isInitialized = true;
        revenueCatStatus.lastError = null;

        return true;
      } catch (methodError) {
        if (showAlerts) {
          Alert.alert("RevenueCat Error", `Verification failed: ${methodError}`);
        }

        await logToCommunication(medplum, "RevenueCat verification failed with getAppUserID", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          error: methodError instanceof Error ? methodError.message : String(methodError),
        });

        configuredSuccessfully = false;
      }
    } else {
      if (showAlerts) {
        Alert.alert("RevenueCat Warning", "getAppUserID() method not available for verification");
      }

      await logToCommunication(medplum, "getAppUserID() method not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
      });
    }

    // If we got a true from isConfigured but failed method verification, something is wrong
    if (configuredSuccessfully) {
      if (showAlerts) {
        Alert.alert(
          "RevenueCat Warning",
          "isConfigured() returned true but method verification failed",
        );
      }

      await logToCommunication(medplum, "RevenueCat inconsistent state detected", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        note: "isConfigured() returned true but method verification failed",
      });
    }
  } catch (error) {
    // Catch any unexpected errors in the verification process
    if (showAlerts) {
      Alert.alert("RevenueCat Error", `Error during verification: ${error}`);
    }

    await logToCommunication(medplum, "Error during RevenueCat verification", {
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Initialize if not already configured
  return initializeRevenueCat(medplum);
};
