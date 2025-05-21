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
      purchasesAvailable: typeof Purchases === "object" && Purchases !== null,
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
    // Verify Purchases object is available
    if (typeof Purchases !== "object" || Purchases === null) {
      const message = "RevenueCat SDK is not available";
      showVisibleMessage("RevenueCat Error", message, true);

      await logToCommunication(medplum, "RevenueCat SDK not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        purchasesType: typeof Purchases,
      });

      return false;
    }

    // Verify configure method is available
    if (typeof Purchases.configure !== "function") {
      const message = "RevenueCat configure method is not available";
      showVisibleMessage("RevenueCat Error", message, true);

      await logToCommunication(medplum, "RevenueCat configure method not available", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        availableMethods: typeof Purchases === "object" ? Object.keys(Purchases).join(",") : "none",
      });

      return false;
    }

    // Check if already configured - ALWAYS VERIFY WITH isConfigured()
    let configuredSuccessfully = false;

    try {
      if (typeof Purchases.isConfigured === "function") {
        configuredSuccessfully = Purchases.isConfigured();

        if (configuredSuccessfully) {
          const message = "RevenueCat is already configured according to isConfigured()";
          showVisibleMessage("RevenueCat Info", message);

          // Double-check by trying to call another method
          try {
            if (typeof Purchases.getAppUserID === "function") {
              const appUserId = await Purchases.getAppUserID();
              showVisibleMessage(
                "RevenueCat Verification",
                `Verified with getAppUserID: ${appUserId}`,
              );

              // If we get here, it's really configured
              isInitialized = true;
              revenueCatStatus.isInitialized = true;

              await logToCommunication(medplum, "RevenueCat verified as configured", {
                platform: Platform.OS,
                environment: __DEV__ ? "development" : "production",
                appUserId,
              });

              return true;
            }
          } catch (verifyError) {
            // If verification fails, it's not really configured properly
            configuredSuccessfully = false;
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
          }
        }
      }
    } catch (configError) {
      showVisibleMessage("RevenueCat Error", `Error checking configuration: ${configError}`, true);

      await logToCommunication(medplum, "Error checking RevenueCat configuration", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        error: configError instanceof Error ? configError.message : String(configError),
      });

      configuredSuccessfully = false;
    }

    // If verification failed, we need to force re-initialization
    if (!configuredSuccessfully) {
      showVisibleMessage("RevenueCat", "Not properly configured, proceeding with initialization");
    }

    // Get the appropriate API key for the platform
    const apiKey = Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;

    // Display which API key we're using (hiding most of it)
    const apiKeyPrefix = apiKey.substring(0, 6);
    const apiKeySuffix = apiKey.substring(apiKey.length - 4);
    showVisibleMessage("RevenueCat", `Configuring with ${apiKeyPrefix}...${apiKeySuffix}`);

    // Set verbose logging in development BEFORE configuration
    if (__DEV__ && typeof Purchases.setLogLevel === "function") {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
    }

    try {
      // Check if already configured by the native module
      if (typeof Purchases.isConfigured === "function" && Purchases.isConfigured()) {
        showVisibleMessage(
          "RevenueCat",
          "Already configured by native module, skipping JS configuration",
        );

        await logToCommunication(medplum, "RevenueCat already configured by native module", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
        });
      } else {
        // Configure RevenueCat from JS only if not already configured
        Purchases.configure({ apiKey });
      }
    } catch (configError) {
      // If checking isConfigured fails, try to configure anyway
      showVisibleMessage(
        "RevenueCat",
        `Error checking configuration status: ${configError}, attempting to configure anyway`,
      );

      try {
        Purchases.configure({ apiKey });
      } catch (secondConfigError) {
        showVisibleMessage(
          "RevenueCat Error",
          `JS configuration failed: ${secondConfigError}`,
          true,
        );

        await logToCommunication(medplum, "RevenueCat JS configuration failed", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          error:
            secondConfigError instanceof Error
              ? secondConfigError.message
              : String(secondConfigError),
        });
      }
    }

    // Verify configuration worked with rigorous checks
    // We need to reset the success flag for another round of checks
    configuredSuccessfully = false;

    // First check isConfigured()
    if (typeof Purchases.isConfigured === "function") {
      try {
        configuredSuccessfully = Purchases.isConfigured();
        showVisibleMessage("RevenueCat", `isConfigured() returned: ${configuredSuccessfully}`);
      } catch (configError) {
        showVisibleMessage("RevenueCat Error", `isConfigured() threw error: ${configError}`, true);
        configuredSuccessfully = false;
      }
    } else {
      showVisibleMessage("RevenueCat Warning", "isConfigured() method not available", true);
      // Don't assume success - we'll verify with other methods
    }

    // Secondary verification - try to call a method that requires initialization
    try {
      if (typeof Purchases.getAppUserID === "function") {
        const appUserId = await Purchases.getAppUserID();
        showVisibleMessage("RevenueCat", `Verified with getAppUserID: ${appUserId}`);

        // If this succeeds, it's definitely configured
        configuredSuccessfully = true;

        await logToCommunication(medplum, "RevenueCat configuration verified with getAppUserID", {
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          appUserId,
        });
      } else {
        showVisibleMessage("RevenueCat Warning", "getAppUserID() method not available", true);
      }
    } catch (verifyError) {
      // If this fails after configure, something is wrong
      showVisibleMessage("RevenueCat Error", `Secondary verification failed: ${verifyError}`, true);
      configuredSuccessfully = false;

      await logToCommunication(medplum, "RevenueCat secondary verification failed", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        error: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
    }

    if (!configuredSuccessfully) {
      const message = "RevenueCat verification failed after configure()";
      showVisibleMessage("RevenueCat Error", message, true);

      await logToCommunication(medplum, "RevenueCat configuration failed verification", {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        apiKeyPrefix: apiKey.substring(0, 6) + "...",
      });

      return false;
    }

    // Success!
    const message = "Successfully initialized RevenueCat!";
    showVisibleMessage("RevenueCat Success", message);

    await logToCommunication(medplum, "RevenueCat initialized successfully", {
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
      apiKeyPrefix: apiKey.substring(0, 6) + "...",
    });

    isInitialized = true;
    revenueCatStatus.isInitialized = true;
    revenueCatStatus.lastError = null;

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
