import { Patient } from "@medplum/fhirtypes";
// Import RevenueCat only on native platforms, not on web
import { useMedplum } from "@medplum/react-hooks";
import React, { createContext, useContext, useEffect, useState } from "react";
import { NativeModules, Platform } from "react-native";
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

  // Helper function to check if the user has premium entitlement
  const checkPremiumEntitlement = React.useCallback((info: CustomerInfo) => {
    const hasPremium = info.entitlements.active[ENTITLEMENT_IDS.PREMIUM] !== undefined;
    setIsPremium(hasPremium);
    
    // Log detailed entitlement info in production builds to help diagnose issues
    if (!__DEV__) {
      console.log(`📱 [SubscriptionContext] Premium entitlement check - Status: ${hasPremium ? "PREMIUM" : "FREE"}`);
      console.log(`📱 [SubscriptionContext] Active entitlements:`, Object.keys(info.entitlements.active));
      console.log(`📱 [SubscriptionContext] User ID:`, info.originalAppUserId);
      
      // Try to log this to Medplum for later analysis
      try {
        const profile = medplum.getProfile();
        if (profile?.id) {
          medplum.createResource({
            resourceType: "Communication",
            status: "completed",
            subject: { reference: `Patient/${profile.id}` },
            about: [{ reference: `Patient/${profile.id}` }],
            sent: new Date().toISOString(),
            payload: [
              {
                contentString: `Subscription status check: ${hasPremium ? "PREMIUM" : "FREE"}`,
              },
              {
                contentString: JSON.stringify({
                  timestamp: new Date().toISOString(),
                  platform: Platform.OS,
                  environment: "production",
                  entitlements: Object.keys(info.entitlements.active),
                  originalAppUserId: info.originalAppUserId,
                  customerInfo: {
                    activeSubscriptions: info.activeSubscriptions,
                    allPurchasedProductIdentifiers: info.allPurchasedProductIdentifiers
                  }
                }),
              },
            ],
          }).catch(error => {
            console.error("📱 [SubscriptionContext] Failed to log entitlement check:", error);
          });
        }
      } catch (error) {
        // Silently handle errors in production
      }
    }
    
    return hasPremium;
  }, [medplum]);

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

  // Safe execution helper for RevenueCat methods
  const safelyExecuteRevenueCatMethod = async <T,>(
    methodName: string,
    method: () => Promise<T>,
    fallbackValue: T,
  ): Promise<T> => {
    if (Platform.OS === "web") {
      console.log(`📱 [SubscriptionContext] Web platform detected, skipping ${methodName}`);
      return fallbackValue;
    }

    try {
      if (typeof method !== "function") {
        console.warn(`📱 [SubscriptionContext] RevenueCat ${methodName} not available`);
        return fallbackValue;
      }

      return await method();
    } catch (error) {
      console.error(`📱 [SubscriptionContext] Error executing ${methodName}:`, error);
      return fallbackValue;
    }
  };

  // The tracking utilities were imported incorrectly - removing this code

  // Initialize RevenueCat when component mounts
  useEffect(() => {
    const initializePurchases = async () => {
      // We'll need to collect some details for logging
      let platformDetails: Record<string, unknown> = {};
      
      // Before doing anything else, log the native modules availability
      try {
        const profile = medplum.getProfile();
        if (profile?.id) {
          const availableNativeModules = Object.keys(NativeModules);
          const hasRNPurchasesModule = !!NativeModules.RNPurchases;
          const platformConstants = Platform.constants ? JSON.stringify(Platform.constants) : "Not available";
          const isHermes = !!global.HermesInternal;
          
          await medplum.createResource({
            resourceType: "Communication",
            status: "completed",
            subject: { reference: `Patient/${profile.id}` },
            about: [{ reference: `Patient/${profile.id}` }],
            sent: new Date().toISOString(),
            payload: [
              {
                contentString: "RevenueCat initialization starting - Native modules check",
              },
              {
                contentString: JSON.stringify({
                  timestamp: new Date().toISOString(),
                  platform: Platform.OS,
                  environment: __DEV__ ? "development" : "production",
                  hasRNPurchasesModule: hasRNPurchasesModule,
                  availableNativeModules: availableNativeModules,
                  platformDetails: platformConstants,
                  isHermes: isHermes,
                  purchasesType: typeof Purchases
                }),
              },
            ],
          });
        }
      } catch (logError) {
        console.error("📱 [SubscriptionContext] Failed to log native modules check:", logError);
      }
      
      try {
        setIsLoading(true);

        // For web platform, skip RevenueCat initialization completely
        if (Platform.OS === "web") {
          console.log(
            "📱 [SubscriptionContext] Web platform detected, skipping RevenueCat initialization",
          );
          platformDetails.platform = "web";
          platformDetails.skipped = true;
          
          // We need to log skipping initialization
          
          setIsPremium(true); // Enable premium features on web for better testing
          setIsLoading(false);
          return;
        }

        // CRUCIAL: Add a delay to ensure native modules are properly initialized
        // This helps prevent the "setLogHandler of null" error
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get the appropriate API key for the platform
        const apiKey =
          Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;
        
        // Add details for logging
        let platformDetails = {
          platform: Platform.OS,
          apiKeyPrefix: apiKey.substring(0, 6) + "..." // Only log prefix for security
        };

        console.log(
          `📱 [SubscriptionContext] Initializing RevenueCat with API key for ${Platform.OS}`,
        );

        try {
          // Handle case where RevenueCat is not available at all
          if (typeof Purchases !== "object" || Purchases === null) {
            console.warn("📱 [SubscriptionContext] RevenueCat SDK is not available");
            
            // Check for native modules to help with debugging
            const availableNativeModules = Object.keys(NativeModules);
            const hasRNPurchasesModule = !!NativeModules.RNPurchases;
            const platformConstants = Platform.constants ? JSON.stringify(Platform.constants) : "Not available";
            const isHermes = !!global.HermesInternal;
            
            // Log this issue as a Communication resource with enhanced debugging info
            try {
              const profile = medplum.getProfile();
              if (profile?.id) {
                await medplum.createResource({
                  resourceType: "Communication",
                  status: "completed",
                  subject: { reference: `Patient/${profile.id}` },
                  about: [{ reference: `Patient/${profile.id}` }],
                  sent: new Date().toISOString(),
                  payload: [
                    {
                      contentString: "RevenueCat SDK not available - DEBUG INFO",
                    },
                    {
                      contentString: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        platform: Platform.OS,
                        environment: __DEV__ ? "development" : "production",
                        purchasesType: typeof Purchases,
                        purchasesValue: String(Purchases),
                        hasRNPurchasesModule: hasRNPurchasesModule,
                        availableNativeModules: availableNativeModules,
                        platformDetails: platformConstants,
                        isHermes: isHermes
                      }),
                    },
                  ],
                });
              }
            } catch (logError) {
              console.error("📱 [SubscriptionContext] Failed to log SDK unavailable:", logError);
            }
            
            // Only default to premium in development
            if (__DEV__) {
              setIsPremium(true); // Default to premium in development
              console.log("📱 [SubscriptionContext] DEV MODE: Defaulting to premium (SDK unavailable)");
            } else {
              setIsPremium(false); // Default to free tier in production
              console.log("📱 [SubscriptionContext] PRODUCTION: Defaulting to free tier (SDK unavailable)");
            }
            
            setIsLoading(false);
            return;
          }

          // IMPORTANT: Configure first, then set log handlers
          // This is the reverse of the previous implementation
          if (typeof Purchases.configure === "function") {
            Purchases.configure({ apiKey });
            console.log("📱 [SubscriptionContext] RevenueCat configured successfully");

            // Now set log level AFTER configuration
            if (typeof Purchases.setLogLevel === "function") {
              Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
            } else {
              console.warn("📱 [SubscriptionContext] RevenueCat setLogLevel method not available");
            }

            // Now set log handler AFTER configuration
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
              console.warn(
                "📱 [SubscriptionContext] RevenueCat setLogHandler method not available",
              );
            }
          } else {
            console.warn("📱 [SubscriptionContext] RevenueCat configure method not available");
            
            // Log this issue as a Communication resource
            try {
              const profile = medplum.getProfile();
              if (profile?.id) {
                await medplum.createResource({
                  resourceType: "Communication",
                  status: "completed",
                  subject: { reference: `Patient/${profile.id}` },
                  about: [{ reference: `Patient/${profile.id}` }],
                  sent: new Date().toISOString(),
                  payload: [
                    {
                      contentString: "RevenueCat configure method not available",
                    },
                    {
                      contentString: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        platform: Platform.OS,
                        environment: __DEV__ ? "development" : "production"
                      }),
                    },
                  ],
                });
              }
            } catch (logError) {
              console.error("📱 [SubscriptionContext] Failed to log configure unavailable:", logError);
            }
            
            // Only default to premium in development
            if (__DEV__) {
              setIsPremium(true); // Default to premium in development
              console.log("📱 [SubscriptionContext] DEV MODE: Defaulting to premium (configure unavailable)");
            } else {
              setIsPremium(false); // Default to free tier in production
              console.log("📱 [SubscriptionContext] PRODUCTION: Defaulting to free tier (configure unavailable)");
            }
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

          // Fetch offerings using the safety helper
          console.log("📱 [SubscriptionContext] Fetching offerings");
          const offerings = await safelyExecuteRevenueCatMethod(
            "getOfferings",
            () => Purchases.getOfferings(),
            { current: null },
          );

          if (offerings && offerings.current?.availablePackages?.length) {
            console.log(
              `📱 [SubscriptionContext] Found ${offerings.current.availablePackages.length} packages`,
            );
            setAvailablePackages(offerings.current.availablePackages);
          } else {
            console.log("📱 [SubscriptionContext] No packages found in current offering");
          }

          // Get customer info using the safety helper
          console.log("📱 [SubscriptionContext] Fetching customer info");
          const info = await safelyExecuteRevenueCatMethod(
            "getCustomerInfo",
            () => Purchases.getCustomerInfo(),
            null,
          );

          if (info) {
            setCustomerInfo(info);
            const hasPremium = checkPremiumEntitlement(info);
            console.log(`📱 [SubscriptionContext] Premium status: ${hasPremium}`);
            
            // We'll log subscription info using Communication resources instead
            try {
              // Log successful subscription check
              const profile = medplum.getProfile();
              if (profile?.id) {
                await medplum.createResource({
                  resourceType: "Communication",
                  status: "completed",
                  subject: { reference: `Patient/${profile.id}` },
                  about: [{ reference: `Patient/${profile.id}` }],
                  sent: new Date().toISOString(),
                  payload: [
                    {
                      contentString: `RevenueCat initialization successful: ${hasPremium ? 'PREMIUM' : 'FREE'}`,
                    },
                    {
                      contentString: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        platform: Platform.OS,
                        environment: __DEV__ ? "development" : "production",
                        customerInfo: {
                          entitlements: Object.keys(info.entitlements.active),
                          activeSubscriptions: info.activeSubscriptions || []
                        }
                      }),
                    },
                  ],
                });
              }
            } catch (logError) {
              console.error("Failed to log successful initialization:", logError);
            }
          } else {
            console.warn("📱 [SubscriptionContext] Customer info returned null");
            
            // Log this failure case with a Communication resource
            try {
              const profile = medplum.getProfile();
              if (profile?.id) {
                await medplum.createResource({
                  resourceType: "Communication",
                  status: "completed",
                  subject: { reference: `Patient/${profile.id}` },
                  about: [{ reference: `Patient/${profile.id}` }],
                  sent: new Date().toISOString(),
                  payload: [
                    {
                      contentString: "RevenueCat customer info returned null",
                    },
                    {
                      contentString: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        platform: Platform.OS,
                        environment: __DEV__ ? "development" : "production",
                        phase: "getCustomerInfo"
                      }),
                    },
                  ],
                });
              }
            } catch (logError) {
              console.error("Failed to log customer info null:", logError);
            }
            
            // IMPORTANT: This is likely why Patient 961 shows as premium
            // Here we default to premium during development, but we're 
            // not checking if this is a production build
            
            // MODIFIED: Only default to premium in development builds
            if (__DEV__) {
              setIsPremium(true); // Default to premium during development
            } else {
              // In production, set to free tier if we can't verify
              setIsPremium(false);
              // Already logging this above
            }
          }
        } catch (error) {
          console.error("📱 [SubscriptionContext] RevenueCat initialization error:", error);
          
          // Log RevenueCat initialization error
          try {
            const profile = medplum.getProfile();
            if (profile?.id) {
              await medplum.createResource({
                resourceType: "Communication",
                status: "completed",
                subject: { reference: `Patient/${profile.id}` },
                about: [{ reference: `Patient/${profile.id}` }],
                sent: new Date().toISOString(),
                payload: [
                  {
                    contentString: "RevenueCat initialization error",
                  },
                  {
                    contentString: JSON.stringify({
                      timestamp: new Date().toISOString(),
                      platform: Platform.OS,
                      environment: __DEV__ ? "development" : "production",
                      phase: "revenueCatInitialization",
                      error: String(error)
                    }),
                  },
                ],
              });
            }
          } catch (logError) {
            console.error("Failed to log RevenueCat initialization error:", logError);
          }
          
          // MODIFIED: Only default to premium in development builds
          if (__DEV__) {
            setIsPremium(true); // Default to premium if error in development
          } else {
            // In production, set to free tier if we can't verify
            setIsPremium(false);
            // Already logging this above
          }
        }
      } catch (error) {
        console.error("📱 [SubscriptionContext] Error initializing subscription:", error);
        
        // Log top-level initialization error
        try {
          const profile = medplum.getProfile();
          if (profile?.id) {
            await medplum.createResource({
              resourceType: "Communication",
              status: "completed",
              subject: { reference: `Patient/${profile.id}` },
              about: [{ reference: `Patient/${profile.id}` }],
              sent: new Date().toISOString(),
              payload: [
                {
                  contentString: "Top-level subscription initialization error",
                },
                {
                  contentString: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    platform: Platform.OS,
                    environment: __DEV__ ? "development" : "production",
                    phase: "outerTry",
                    error: String(error)
                  }),
                },
              ],
            });
          }
        } catch (logError) {
          console.error("Failed to log top-level error:", logError);
        }
        
        // MODIFIED: Only default to premium in development builds
        if (__DEV__) {
          setIsPremium(true); // Default to premium if error in development
        } else {
          // In production, set to free tier if we can't verify
          setIsPremium(false);
          // Already logging this above
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Increase the delay to ensure native modules are properly loaded
    const timer = setTimeout(() => {
      initializePurchases();
    }, 5000); // Increased from 2000ms to 5000ms for better native module initialization

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
  }, [medplum, storeSubscriptionStatusToMedplum, checkPremiumEntitlement]);

  // Function to handle purchasing a package
  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoading(true);

      // For web platform, simulate successful purchase
      if (Platform.OS === "web") {
        console.log("📱 [SubscriptionContext] Web platform detected, simulating purchase");
        
        // Log this simulation as a Communication resource
        try {
          const profile = medplum.getProfile();
          if (profile?.id) {
            await medplum.createResource({
              resourceType: "Communication",
              status: "completed",
              subject: { reference: `Patient/${profile.id}` },
              about: [{ reference: `Patient/${profile.id}` }],
              sent: new Date().toISOString(),
              payload: [
                {
                  contentString: "Web platform purchase simulation",
                },
                {
                  contentString: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    packageIdentifier: pkg?.identifier,
                    simulation: true,
                    platform: "web"
                  }),
                },
              ],
            });
          }
        } catch (logError) {
          console.error("📱 [SubscriptionContext] Failed to log web purchase:", logError);
        }
        
        // On web, we always simulate successful purchase
        setIsPremium(true);
        return true;
      }

      // Check if RevenueCat SDK is available
      if (typeof Purchases !== "object" || Purchases === null) {
        console.warn("📱 [SubscriptionContext] RevenueCat SDK is not available");
        
        // Log this issue as a Communication resource
        try {
          const profile = medplum.getProfile();
          if (profile?.id) {
            await medplum.createResource({
              resourceType: "Communication",
              status: "completed",
              subject: { reference: `Patient/${profile.id}` },
              about: [{ reference: `Patient/${profile.id}` }],
              sent: new Date().toISOString(),
              payload: [
                {
                  contentString: "RevenueCat SDK not available during purchase",
                },
                {
                  contentString: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    packageIdentifier: pkg?.identifier,
                    platform: Platform.OS,
                    environment: __DEV__ ? "development" : "production"
                  }),
                },
              ],
            });
          }
        } catch (logError) {
          console.error("📱 [SubscriptionContext] Failed to log purchase SDK unavailable:", logError);
        }
        
        // Only simulate successful purchase in development
        if (__DEV__) {
          setIsPremium(true);
          console.log("📱 [SubscriptionContext] DEV MODE: Simulating successful purchase");
          return true;
        } else {
          console.log("📱 [SubscriptionContext] PRODUCTION: Cannot process purchase without SDK");
          return false;
        }
      }

      // Make the purchase using our safe execution helper
      const purchaseResult = await safelyExecuteRevenueCatMethod(
        "purchasePackage",
        async () => Purchases.purchasePackage(pkg),
        { customerInfo: null },
      );

      if (purchaseResult?.customerInfo) {
        setCustomerInfo(purchaseResult.customerInfo);
        const hasPremium = checkPremiumEntitlement(purchaseResult.customerInfo);
        await storeSubscriptionStatusToMedplum(purchaseResult.customerInfo);
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
        
        // Log this simulation as a Communication resource
        try {
          const profile = medplum.getProfile();
          if (profile?.id) {
            await medplum.createResource({
              resourceType: "Communication",
              status: "completed",
              subject: { reference: `Patient/${profile.id}` },
              about: [{ reference: `Patient/${profile.id}` }],
              sent: new Date().toISOString(),
              payload: [
                {
                  contentString: "Web platform restore simulation",
                },
                {
                  contentString: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    simulation: true,
                    platform: "web"
                  }),
                },
              ],
            });
          }
        } catch (logError) {
          console.error("📱 [SubscriptionContext] Failed to log web restore:", logError);
        }
        
        // On web, we always simulate successful restore
        setIsPremium(true);
        return true;
      }

      // Check if RevenueCat SDK is available
      if (typeof Purchases !== "object" || Purchases === null) {
        console.warn("📱 [SubscriptionContext] RevenueCat SDK is not available");
        
        // Log this issue as a Communication resource
        try {
          const profile = medplum.getProfile();
          if (profile?.id) {
            await medplum.createResource({
              resourceType: "Communication",
              status: "completed",
              subject: { reference: `Patient/${profile.id}` },
              about: [{ reference: `Patient/${profile.id}` }],
              sent: new Date().toISOString(),
              payload: [
                {
                  contentString: "RevenueCat SDK not available during restore",
                },
                {
                  contentString: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    platform: Platform.OS,
                    environment: __DEV__ ? "development" : "production"
                  }),
                },
              ],
            });
          }
        } catch (logError) {
          console.error("📱 [SubscriptionContext] Failed to log restore SDK unavailable:", logError);
        }
        
        // Only simulate successful restore in development
        if (__DEV__) {
          setIsPremium(true);
          console.log("📱 [SubscriptionContext] DEV MODE: Simulating successful restore");
          return true;
        } else {
          console.log("📱 [SubscriptionContext] PRODUCTION: Cannot restore purchases without SDK");
          return false;
        }
      }

      // Restore purchases using our safe execution helper
      const customerInfo = await safelyExecuteRevenueCatMethod(
        "restorePurchases",
        async () => Purchases.restorePurchases(),
        null,
      );

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

      const info = await safelyExecuteRevenueCatMethod(
        "getCustomerInfo (debug)",
        async () => Purchases.getCustomerInfo(),
        null,
      );

      if (info) {
        console.log(
          "📱 [SubscriptionContext] Debug: Customer info retrieved:",
          JSON.stringify(info, null, 2),
        );

        // Update state with fresh data
        setCustomerInfo(info);
        const hasPremium = checkPremiumEntitlement(info);
        console.log(`📱 [SubscriptionContext] Debug: Updated premium status: ${hasPremium}`);
      } else {
        console.warn("📱 [SubscriptionContext] Debug: No customer info retrieved");
      }
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

      const offerings = await safelyExecuteRevenueCatMethod(
        "getOfferings (debug)",
        async () => Purchases.getOfferings(),
        { current: null },
      );

      if (offerings) {
        console.log(
          "📱 [SubscriptionContext] Debug: Offerings retrieved:",
          JSON.stringify(offerings, null, 2),
        );

        // Update state with fresh data
        if (offerings.current?.availablePackages?.length) {
          setAvailablePackages(offerings.current.availablePackages);
          console.log(
            `📱 [SubscriptionContext] Debug: Updated packages: ${offerings.current.availablePackages.length}`,
          );
        } else {
          console.log("📱 [SubscriptionContext] Debug: No packages found in current offering");
        }
      } else {
        console.warn("📱 [SubscriptionContext] Debug: No offerings retrieved");
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

    if (typeof PurchasesDebugUI !== "object" || PurchasesDebugUI === null) {
      console.warn("📱 [SubscriptionContext] Debug: PurchasesDebugUI is not available");
      return;
    }

    try {
      console.log("📱 [SubscriptionContext] Debug: Refreshing Debug UI Overlay");

      // Safely execute the hideDebugUI method
      const safelyExecuteUIMethod = (methodName: string, method: () => void): boolean => {
        try {
          if (typeof method === "function") {
            method();
            return true;
          } else {
            console.warn(`📱 [SubscriptionContext] Debug: ${methodName} method not available`);
            return false;
          }
        } catch (error) {
          console.error(`📱 [SubscriptionContext] Debug: Error executing ${methodName}:`, error);
          return false;
        }
      };

      // Hide and then show again to refresh
      const hideSuccessful = safelyExecuteUIMethod("hideDebugUI", PurchasesDebugUI.hideDebugUI);

      if (hideSuccessful) {
        setTimeout(() => {
          const showSuccessful = safelyExecuteUIMethod("showDebugUI", PurchasesDebugUI.showDebugUI);
          if (showSuccessful) {
            console.log("📱 [SubscriptionContext] Debug: Debug UI refreshed");
          }
        }, 500);
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
