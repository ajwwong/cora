import { Patient } from "@medplum/fhirtypes";
// Import RevenueCat only on native platforms, not on web
import { useMedplum } from "@medplum/react-hooks";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
// Import RevenueCat for all platforms
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesDebugUI,
  PurchasesPackage,
} from "react-native-purchases";

import {
  ENTITLEMENT_IDS,
  REVENUE_CAT_API_KEYS,
  SUBSCRIPTION_STATUS_EXTENSION_URL,
} from "../utils/subscription/config";

// Type definitions for the context
type SubscriptionContextType = {
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  availablePackages: PurchasesPackage[] | null;
  isPremium: boolean;
  restorePurchases: () => Promise<boolean>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  checkEntitlementStatus: (entitlementId: string) => boolean;
  // Debug methods
  debugGetCustomerInfo: () => Promise<void>;
  debugGetOfferings: () => Promise<void>;
  debugRefreshUI: () => void;
};

// Mock implementation for development when RevenueCat is not available
const mockSubscriptionValue: SubscriptionContextType = {
  isLoading: false,
  customerInfo: null,
  availablePackages: [],
  isPremium: true, // Set to true to enable premium features during development
  restorePurchases: async () => true,
  purchasePackage: async () => true,
  checkEntitlementStatus: () => true,
  // Mock debug methods
  debugGetCustomerInfo: async () => console.log("Debug: Mock customer info fetch"),
  debugGetOfferings: async () => console.log("Debug: Mock offerings fetch"),
  debugRefreshUI: () => console.log("Debug: Mock refresh UI"),
};

// Create the context with undefined default value
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Hook for consuming the context in components
export const useSubscription = () => {
  try {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
      console.warn("📱 [useSubscription] No context found, using mock implementation");
      return mockSubscriptionValue;
    }
    return context;
  } catch (error) {
    console.error("📱 [useSubscription] Error getting subscription context:", error);
    // Return mock implementation in case of error during development
    return mockSubscriptionValue;
  }
};

// Provider component that wraps the app
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [availablePackages, setAvailablePackages] = useState<PurchasesPackage[] | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const medplum = useMedplum();

  // Initialize RevenueCat when component mounts
  useEffect(() => {
    const initializePurchases = async () => {
      try {
        setIsLoading(true);

        // For web platform, skip RevenueCat initialization completely
        if (Platform.OS === "web") {
          console.log(
            "📱 [SubscriptionContext] Web platform detected, skipping RevenueCat initialization",
          );
          setIsPremium(true); // Enable premium features on web for better testing
          setIsLoading(false);
          return;
        }

        // Get the appropriate API key for the platform
        const apiKey =
          Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;

        console.log(
          `📱 [SubscriptionContext] Initializing RevenueCat with API key for ${Platform.OS}`,
        );

        try {
          // Check if RevenueCat SDK is available before using it
          if (!Purchases) {
            console.warn("📱 [SubscriptionContext] RevenueCat SDK is null or undefined");
            setIsPremium(true); // Default to premium if SDK not available
            return;
          }

          // Set up custom log handler with safety check
          if (typeof Purchases.setLogHandler === "function") {
            Purchases.setLogHandler((logLevel, message) => {
              const levels = {
                [LOG_LEVEL.VERBOSE]: "VERBOSE",
                [LOG_LEVEL.DEBUG]: "DEBUG",
                [LOG_LEVEL.INFO]: "INFO",
                [LOG_LEVEL.WARN]: "WARN",
                [LOG_LEVEL.ERROR]: "ERROR",
              };

              // Format log message with timestamp, level, and message
              const formattedLevel = levels[logLevel] || "UNKNOWN";
              const timestamp = new Date().toISOString();
              const formattedMessage = `[${timestamp}] [RevenueCat][${formattedLevel}] ${message}`;

              // Log to console with appropriate level
              switch (logLevel) {
                case LOG_LEVEL.ERROR:
                  console.error(formattedMessage);
                  break;
                case LOG_LEVEL.WARN:
                  console.warn(formattedMessage);
                  break;
                default:
                  console.log(formattedMessage);
              }

              // In a production app, you could also send logs to a remote logging service here
            });
          } else {
            console.warn("📱 [SubscriptionContext] RevenueCat setLogHandler method not available");
          }

          // Set log level to VERBOSE for detailed logging
          console.log("📱 [SubscriptionContext] Setting log level to VERBOSE");
          if (typeof Purchases.setLogLevel === "function") {
            Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
          } else {
            console.warn("📱 [SubscriptionContext] RevenueCat setLogLevel method not available");
          }

          // Simple configuration based on RevenueCat docs
          console.log("📱 [SubscriptionContext] Configuring RevenueCat");
          if (typeof Purchases.configure === "function") {
            Purchases.configure({ apiKey });
            console.log("📱 [SubscriptionContext] RevenueCat initialized successfully");
          } else {
            console.warn("📱 [SubscriptionContext] RevenueCat configure method not available");
            setIsPremium(true); // Default to premium if configure method not available
          }

          // Show debug UI overlay for easier debugging
          if (Platform.OS !== "web" && PurchasesDebugUI) {
            try {
              console.log("📱 [SubscriptionContext] Enabling RevenueCat Debug UI Overlay");
              if (typeof PurchasesDebugUI.showDebugUI === "function") {
                PurchasesDebugUI.showDebugUI();
              } else {
                console.warn(
                  "📱 [SubscriptionContext] RevenueCat showDebugUI method not available",
                );
              }
            } catch (error) {
              console.error("📱 [SubscriptionContext] Failed to enable Debug UI Overlay:", error);
            }
          }

          // Fetch offerings
          console.log("📱 [SubscriptionContext] Fetching offerings");
          if (typeof Purchases.getOfferings === "function") {
            try {
              const offerings = await Purchases.getOfferings();
              if (offerings && offerings.current?.availablePackages?.length) {
                console.log(
                  `📱 [SubscriptionContext] Found ${offerings.current.availablePackages.length} packages`,
                );
                setAvailablePackages(offerings.current.availablePackages);
              } else {
                console.log("📱 [SubscriptionContext] No packages found in current offering");
              }
            } catch (error) {
              console.error("📱 [SubscriptionContext] Error fetching offerings:", error);
            }
          } else {
            console.warn("📱 [SubscriptionContext] RevenueCat getOfferings method not available");
          }

          // Get customer info
          console.log("📱 [SubscriptionContext] Fetching customer info");
          if (typeof Purchases.getCustomerInfo === "function") {
            try {
              const info = await Purchases.getCustomerInfo();
              if (info) {
                setCustomerInfo(info);
                const hasPremium = checkPremiumEntitlement(info);
                console.log(`📱 [SubscriptionContext] Premium status: ${hasPremium}`);
              } else {
                console.warn("📱 [SubscriptionContext] Customer info returned null");
                setIsPremium(true); // Default to premium during development
              }
            } catch (error) {
              console.error("📱 [SubscriptionContext] Error fetching customer info:", error);
              setIsPremium(true); // Default to premium if error
            }
          } else {
            console.warn(
              "📱 [SubscriptionContext] RevenueCat getCustomerInfo method not available",
            );
            setIsPremium(true); // Default to premium if method not available
          }
        } catch (error) {
          console.error("📱 [SubscriptionContext] RevenueCat initialization error:", error);
          setIsPremium(true); // Default to premium if error
        }
      } catch (error) {
        console.error("📱 [SubscriptionContext] Error initializing subscription:", error);
        setIsPremium(true); // Default to premium if error
      } finally {
        setIsLoading(false);
      }
    };

    // Set up RevenueCat only after component has mounted
    const timer = setTimeout(() => {
      initializePurchases();
    }, 100);

    // Set up a listener for purchases on native platforms
    let purchaseListener: unknown = null;
    if (Platform.OS !== "web" && Purchases) {
      try {
        if (typeof Purchases.addCustomerInfoUpdateListener === "function") {
          purchaseListener = Purchases.addCustomerInfoUpdateListener((info) => {
            console.log("📱 [SubscriptionContext] Customer info updated");
            if (info) {
              setCustomerInfo(info);
              checkPremiumEntitlement(info);
              storeSubscriptionStatusToMedplum(info);
            }
          });
          console.log("📱 [SubscriptionContext] Purchase listener set up successfully");
        } else {
          console.warn(
            "📱 [SubscriptionContext] RevenueCat addCustomerInfoUpdateListener method not available",
          );
        }
      } catch (error) {
        console.error("📱 [SubscriptionContext] Failed to set up purchase listener:", error);
      }
    }

    return () => {
      clearTimeout(timer);
      if (purchaseListener && typeof purchaseListener.remove === "function") {
        try {
          purchaseListener.remove();
          console.log("📱 [SubscriptionContext] Purchase listener removed");
        } catch (error) {
          console.error("📱 [SubscriptionContext] Error removing purchase listener:", error);
        }
      }
    };
  }, [medplum]);

  // Helper function to check if the user has premium entitlement
  const checkPremiumEntitlement = (info: CustomerInfo) => {
    const hasPremium = info.entitlements.active[ENTITLEMENT_IDS.PREMIUM] !== undefined;
    setIsPremium(hasPremium);
    return hasPremium;
  };

  // Save subscription status to Medplum as a FHIR extension
  const storeSubscriptionStatusToMedplum = React.useCallback(
    async (info: CustomerInfo) => {
      // This function stores the subscription status in the Medplum FHIR record
      try {
        const profile = medplum.getProfile();
        if (!profile?.id) return;

        // Get the patient resource
        const patient = await medplum.readResource("Patient", profile.id);
        if (!patient) return;

        // Prepare updated patient with subscription info
        const updatedPatient: Patient = {
          ...patient,
          extension: [
            ...(patient.extension || []).filter(
              (ext) => ext.url !== SUBSCRIPTION_STATUS_EXTENSION_URL,
            ),
            {
              url: SUBSCRIPTION_STATUS_EXTENSION_URL,
              valueString: JSON.stringify({
                customerId: info.originalAppUserId,
                isPremium: checkPremiumEntitlement(info),
                expirationDate: info.entitlements.active[ENTITLEMENT_IDS.PREMIUM]?.expiresDate,
                productIdentifier:
                  info.entitlements.active[ENTITLEMENT_IDS.PREMIUM]?.productIdentifier,
              }),
            },
          ],
        };

        // Update the patient resource
        await medplum.updateResource(updatedPatient);
      } catch (error) {
        console.error("Error storing subscription status to Medplum:", error);
      }
    },
    [medplum, checkPremiumEntitlement],
  );

  // Function to handle purchasing a package
  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoading(true);

      // For web platform, simulate successful purchase
      if (Platform.OS === "web") {
        console.log("📱 [SubscriptionContext] Web platform detected, simulating purchase");
        setIsPremium(true);
        return true;
      }

      // Check if RevenueCat SDK is available
      if (!Purchases || typeof Purchases.purchasePackage !== "function") {
        console.warn("📱 [SubscriptionContext] RevenueCat not available for purchasing");
        // During development, simulate successful purchase
        setIsPremium(true);
        return true;
      }

      // Make the purchase
      if (typeof Purchases.purchasePackage !== "function") {
        console.warn("📱 [SubscriptionContext] RevenueCat purchasePackage method not available");
        setIsPremium(true); // Default to premium if method not available
        return true;
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (customerInfo) {
        setCustomerInfo(customerInfo);
        const hasPremium = checkPremiumEntitlement(customerInfo);
        await storeSubscriptionStatusToMedplum(customerInfo);
        return hasPremium;
      } else {
        console.warn("📱 [SubscriptionContext] Purchase returned no customer info");
        return false;
      }
    } catch (error: unknown) {
      const purchaseError = error as { userCancelled?: boolean };
      if (purchaseError && purchaseError.userCancelled) {
        console.log("User cancelled purchase");
      } else {
        console.error("Purchase error:", error);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to restore purchases
  const restorePurchases = async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      // For web platform, simulate successful restore
      if (Platform.OS === "web") {
        console.log("📱 [SubscriptionContext] Web platform detected, simulating restore");
        setIsPremium(true);
        return true;
      }

      // Check if RevenueCat SDK is available
      if (!Purchases || typeof Purchases.restorePurchases !== "function") {
        console.warn("📱 [SubscriptionContext] RevenueCat not available for restoring purchases");
        // During development, simulate successful restore
        setIsPremium(true);
        return true;
      }

      // Restore purchases
      if (typeof Purchases.restorePurchases !== "function") {
        console.warn("📱 [SubscriptionContext] RevenueCat restorePurchases method not available");
        setIsPremium(true); // Default to premium if method not available
        return true;
      }
      const customerInfo = await Purchases.restorePurchases();

      if (customerInfo) {
        setCustomerInfo(customerInfo);
        const hasPremium = checkPremiumEntitlement(customerInfo);
        await storeSubscriptionStatusToMedplum(customerInfo);
        return hasPremium;
      } else {
        console.warn("📱 [SubscriptionContext] Restore returned no customer info");
        return false;
      }
    } catch (error) {
      console.error("Error restoring purchases:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check entitlement status
  const checkEntitlementStatus = (entitlementId: string): boolean => {
    if (!customerInfo) return false;
    return !!customerInfo.entitlements.active[entitlementId];
  };

  // Debug utility methods
  const debugGetCustomerInfo = async (): Promise<void> => {
    try {
      console.log("📱 [SubscriptionContext] Debug: Manually fetching customer info");
      if (Platform.OS === "web") {
        console.log(
          "📱 [SubscriptionContext] Debug: Web platform detected, cannot fetch customer info",
        );
        return;
      }

      if (!Purchases || typeof Purchases.getCustomerInfo !== "function") {
        console.warn("📱 [SubscriptionContext] Debug: RevenueCat getCustomerInfo not available");
        return;
      }
      const info = await Purchases.getCustomerInfo();
      console.log(
        "📱 [SubscriptionContext] Debug: Customer info retrieved:",
        JSON.stringify(info, null, 2),
      );

      // Update state with fresh data
      setCustomerInfo(info);
      const hasPremium = checkPremiumEntitlement(info);
      console.log(`📱 [SubscriptionContext] Debug: Updated premium status: ${hasPremium}`);
    } catch (error) {
      console.error("📱 [SubscriptionContext] Debug: Error fetching customer info:", error);
    }
  };

  const debugGetOfferings = async (): Promise<void> => {
    try {
      console.log("📱 [SubscriptionContext] Debug: Manually fetching offerings");
      if (Platform.OS === "web") {
        console.log(
          "📱 [SubscriptionContext] Debug: Web platform detected, cannot fetch offerings",
        );
        return;
      }

      if (!Purchases || typeof Purchases.getOfferings !== "function") {
        console.warn("📱 [SubscriptionContext] Debug: RevenueCat getOfferings not available");
        return;
      }
      const offerings = await Purchases.getOfferings();
      console.log(
        "📱 [SubscriptionContext] Debug: Offerings retrieved:",
        JSON.stringify(offerings, null, 2),
      );

      // Update state with fresh data
      if (offerings && offerings.current?.availablePackages?.length) {
        setAvailablePackages(offerings.current.availablePackages);
        console.log(
          `📱 [SubscriptionContext] Debug: Updated packages: ${offerings.current.availablePackages.length}`,
        );
      } else {
        console.log("📱 [SubscriptionContext] Debug: No packages found in current offering");
      }
    } catch (error) {
      console.error("📱 [SubscriptionContext] Debug: Error fetching offerings:", error);
    }
  };

  const debugRefreshUI = (): void => {
    // Function to refresh RevenueCat Debug UI overlay
    if (Platform.OS === "web") {
      console.log("📱 [SubscriptionContext] Debug: Web platform detected, cannot refresh Debug UI");
      return;
    }

    if (!PurchasesDebugUI) {
      console.warn("📱 [SubscriptionContext] Debug: PurchasesDebugUI is not available");
      return;
    }

    try {
      console.log("📱 [SubscriptionContext] Debug: Refreshing Debug UI Overlay");
      // Hide and then show again to refresh
      if (typeof PurchasesDebugUI.hideDebugUI === "function") {
        PurchasesDebugUI.hideDebugUI();

        setTimeout(() => {
          if (typeof PurchasesDebugUI.showDebugUI === "function") {
            PurchasesDebugUI.showDebugUI();
            console.log("📱 [SubscriptionContext] Debug: Debug UI refreshed");
          } else {
            console.warn("📱 [SubscriptionContext] Debug: showDebugUI method not available");
          }
        }, 500);
      } else {
        console.warn("📱 [SubscriptionContext] Debug: hideDebugUI method not available");
      }
    } catch (error) {
      console.error("📱 [SubscriptionContext] Debug: Error refreshing Debug UI:", error);
    }
  };

  // Provide the context value
  const contextValue: SubscriptionContextType = {
    isLoading,
    customerInfo,
    availablePackages,
    isPremium,
    restorePurchases,
    purchasePackage,
    checkEntitlementStatus,
    // Debug methods
    debugGetCustomerInfo,
    debugGetOfferings,
    debugRefreshUI,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>{children}</SubscriptionContext.Provider>
  );
};
