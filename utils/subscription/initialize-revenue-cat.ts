/**
 * RevenueCat initialization utility
 * This file provides a function to initialize RevenueCat properly before usage
 * with system logging using AuditEvent resources instead of user-facing alerts
 */

import { MedplumClient } from "@medplum/core";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

import { trackSubscriptionEvent } from "@/utils/system-logging";

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
 * Log RevenueCat events using the system logging utility
 */
const logRevenueCatEvent = async (
  title: string,
  message: string,
  isError = false,
  medplumClient: MedplumClient | null = null,
  details: Record<string, unknown> = {},
) => {
  // Log to console for development
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

  // Log to AuditEvent if available
  if (medplumClient) {
    try {
      await trackSubscriptionEvent(
        medplumClient,
        "initialization",
        !isError,
        {
          title,
          message,
          platform: Platform.OS,
          environment: __DEV__ ? "development" : "production",
          ...details,
        },
        isError ? message : undefined,
      );
    } catch (error) {
      console.error(`Failed to log RevenueCat event "${title}":`, error);
    }
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
 * Initialize RevenueCat SDK with system logging instead of user alerts
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
    await logRevenueCatEvent("RevenueCat Info", message, false, medplum, {
      platform: "web",
      environment: __DEV__ ? "development" : "production",
    });
    return false;
  }

  // Don't initialize multiple times
  if (isInitialized) {
    const message = "RevenueCat already initialized, skipping";
    await logRevenueCatEvent("RevenueCat Info", message, false, medplum, {
      platform: Platform.OS,
      environment: __DEV__ ? "development" : "production",
    });
    return true;
  }

  // Log initialization attempt
  await logRevenueCatEvent("RevenueCat", "Starting initialization...", false, medplum, {
    platform: Platform.OS,
    environment: __DEV__ ? "development" : "production",
    purchasesType: typeof Purchases,
  });

  try {
    // Wait a short moment to ensure native module is registered
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify Purchases object is available
    if (typeof Purchases === "undefined" || Purchases === null) {
      const message = "RevenueCat SDK is not available";
      await logRevenueCatEvent("RevenueCat Error", message, true, medplum, {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        purchasesType: typeof Purchases,
      });
      return false;
    }

    // Gather diagnostic info about the Purchases object
    const hasConfigureMethod = typeof Purchases.configure === "function";
    const hasIsConfiguredMethod = typeof Purchases.isConfigured === "function";

    await logRevenueCatEvent(
      "RevenueCat Initialization Check",
      "Checking methods",
      false,
      medplum,
      {
        hasConfigureMethod,
        hasIsConfiguredMethod,
        platform: Platform.OS,
      },
    );

    // Verify configure method is available
    if (!hasConfigureMethod) {
      const message = "RevenueCat configure method is not available";
      await logRevenueCatEvent("RevenueCat Error", message, true, medplum, {
        platform: Platform.OS,
        environment: __DEV__ ? "development" : "production",
        availableMethods: typeof Purchases === "object" ? Object.keys(Purchases).join(",") : "none",
      });
      return false;
    }

    // Check if already configured by native side
    let configuredSuccessfully = false;
    let nativelyConfigured = false;

    try {
      if (hasIsConfiguredMethod) {
        configuredSuccessfully = await Promise.resolve(Purchases.isConfigured());

        if (configuredSuccessfully) {
          await logRevenueCatEvent(
            "RevenueCat",
            "Already configured by native module",
            false,
            medplum,
          );
          nativelyConfigured = true;

          // Verify with a method call
          try {
            if (typeof Purchases.getAppUserID === "function") {
              const appUserId = await Purchases.getAppUserID();
              await logRevenueCatEvent(
                "RevenueCat",
                `Verified with getAppUserID: ${appUserId}`,
                false,
                medplum,
                {
                  appUserId,
                },
              );

              // Everything is working - mark as initialized
              isInitialized = true;
              revenueCatStatus.isInitialized = true;
              return true;
            }
          } catch (verifyError) {
            await logRevenueCatEvent(
              "RevenueCat Warning",
              `isConfigured() returns true but verification failed: ${verifyError}`,
              true,
              medplum,
              {
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
      await logRevenueCatEvent(
        "RevenueCat Error",
        `Error checking configuration status: ${configError}, will attempt JS configuration`,
        true,
        medplum,
        {
          error: configError instanceof Error ? configError.message : String(configError),
        },
      );
      configuredSuccessfully = false;
      nativelyConfigured = false;
    }

    // If not already configured by native module, proceed with JS configuration
    if (!nativelyConfigured) {
      await logRevenueCatEvent(
        "RevenueCat",
        "Not configured by native module, proceeding with JS initialization",
        false,
        medplum,
      );

      // Get the appropriate API key for the platform
      const apiKey =
        Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;

      // Set verbose logging in development BEFORE configuration
      if (__DEV__ && typeof Purchases.setLogLevel === "function") {
        try {
          Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
        } catch (logError) {
          console.warn("Could not set RevenueCat log level:", logError);
        }
      }

      try {
        // Configure RevenueCat from JS
        Purchases.configure({ apiKey });
        await logRevenueCatEvent("RevenueCat", "Configured from JavaScript", false, medplum);

        // Verify configuration worked with a method call
        try {
          if (typeof Purchases.getAppUserID === "function") {
            const appUserId = await Purchases.getAppUserID();
            await logRevenueCatEvent(
              "RevenueCat",
              `Verified with getAppUserID: ${appUserId}`,
              false,
              medplum,
              {
                appUserId,
              },
            );

            configuredSuccessfully = true;
            isInitialized = true;
            revenueCatStatus.isInitialized = true;
            return true;
          }
        } catch (verifyError) {
          await logRevenueCatEvent(
            "RevenueCat Error",
            `Verification failed after JS configuration: ${verifyError}`,
            true,
            medplum,
            {
              error: String(verifyError),
            },
          );
          return false;
        }
      } catch (configError) {
        await logRevenueCatEvent(
          "RevenueCat Error",
          `JS configuration failed: ${configError}`,
          true,
          medplum,
          {
            error: configError instanceof Error ? configError.message : String(configError),
          },
        );
        return false;
      }
    }

    // If we get here but initialization is still not detected, return false
    if (!isInitialized) {
      await logRevenueCatEvent(
        "RevenueCat Error",
        "Initialization process completed but status checks failed",
        true,
        medplum,
      );
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logRevenueCatEvent(
      "RevenueCat Error",
      `Initialization failed: ${errorMessage}`,
      true,
      medplum,
      {
        error: errorMessage,
      },
    );
    return false;
  }
};

/**
 * Ensure RevenueCat is initialized before performing operations
 * @param medplum - MedplumClient for logging (optional)
 * @param showAlerts - Whether to show alerts (default: false, now logs to system instead)
 * @returns true if initialized successfully, false otherwise
 */
export const ensureRevenueCatInitialized = async (
  medplum: MedplumClient | null = null,
  showAlerts = false, // Changed default to false
): Promise<boolean> => {
  // If already initialized, return true
  if (isInitialized) return true;

  await logRevenueCatEvent("RevenueCat", "Checking initialization status...", false, medplum);

  // Do more rigorous verification with isConfigured AND method calls
  try {
    let configuredSuccessfully = false;

    // Check isConfigured first
    if (typeof Purchases.isConfigured === "function") {
      try {
        configuredSuccessfully = await Promise.resolve(Purchases.isConfigured());
        await logRevenueCatEvent(
          "RevenueCat Check",
          `isConfigured() returned: ${configuredSuccessfully}`,
          false,
          medplum,
        );
      } catch (configError) {
        await logRevenueCatEvent(
          "RevenueCat Error",
          `Error calling isConfigured(): ${configError}`,
          true,
          medplum,
          {
            error: configError instanceof Error ? configError.message : String(configError),
          },
        );
        configuredSuccessfully = false;
      }
    } else {
      await logRevenueCatEvent(
        "RevenueCat Info",
        "isConfigured() method not available, trying other methods",
        false,
        medplum,
      );
    }

    // IMPORTANT: Even if isConfigured() returns true, verify with a method call
    if (typeof Purchases.getAppUserID === "function") {
      try {
        const appUserId = await Purchases.getAppUserID();
        await logRevenueCatEvent(
          "RevenueCat Verification",
          `Verified with getAppUserID: ${appUserId}`,
          false,
          medplum,
          {
            appUserId,
          },
        );

        // If this succeeds, it's definitely configured
        configuredSuccessfully = true;
        isInitialized = true;
        revenueCatStatus.isInitialized = true;
        revenueCatStatus.lastError = null;
        return true;
      } catch (methodError) {
        await logRevenueCatEvent(
          "RevenueCat Error",
          `Verification failed: ${methodError}`,
          true,
          medplum,
          {
            error: methodError instanceof Error ? methodError.message : String(methodError),
          },
        );
        configuredSuccessfully = false;
      }
    } else {
      await logRevenueCatEvent(
        "RevenueCat Warning",
        "getAppUserID() method not available for verification",
        false,
        medplum,
      );
    }

    // If we got a true from isConfigured but failed method verification, something is wrong
    if (configuredSuccessfully) {
      await logRevenueCatEvent(
        "RevenueCat Warning",
        "isConfigured() returned true but method verification failed",
        false,
        medplum,
        {
          note: "Inconsistent state detected",
        },
      );
    }
  } catch (error) {
    // Catch any unexpected errors in the verification process
    await logRevenueCatEvent(
      "RevenueCat Error",
      `Error during verification: ${error}`,
      true,
      medplum,
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  // Initialize if not already configured
  return initializeRevenueCat(medplum);
};
