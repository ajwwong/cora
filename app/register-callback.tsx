import { useMedplum } from "@medplum/react-hooks";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/**
 * Registration callback page for web platform
 * Handles the response from the web registration page and provides similar functionality
 * to the deep link handling in mobile apps
 */
export default function RegisterCallback() {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const medplum = useMedplum();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing registration...");

  useEffect(() => {
    const processRegistration = async () => {
      try {
        // Get success status
        const success = searchParams.get("success");

        if (success === "true") {
          // Check if we have auth tokens for auto-login
          const accessToken = searchParams.get("access_token");
          const refreshToken = searchParams.get("refresh_token");
          const profileId = searchParams.get("profile_id");

          if (accessToken && refreshToken) {
            try {
              console.log("Setting active login with tokens from registration");

              // Set active login using the tokens from the web registration
              await medplum.setActiveLogin({
                accessToken,
                refreshToken,
                profile: profileId || undefined,
              });

              // Verify login was successful
              const loginState = await medplum.getActiveLogin();
              console.log("Login successful:", !!loginState);

              // Link with RevenueCat if we have a profile ID
              if (profileId) {
                // Attempt RevenueCat login with retry mechanism
                const attemptRevenueCatLogin = async (retryCount = 0) => {
                  try {
                    // Check if we're on web (where RevenueCat isn't supported)
                    if (Platform.OS === "web") {
                      return console.log("RevenueCat login skipped on web platform");
                    }

                    // Basic check for Purchases object
                    if (!Purchases) {
                      throw new Error("Purchases object not available");
                    }

                    // Create Communication resource log before login attempt
                    try {
                      await medplum.createResource({
                        resourceType: "Communication",
                        status: "completed",
                        subject: { reference: `Patient/${profileId}` },
                        about: [{ reference: `Patient/${profileId}` }],
                        sent: new Date().toISOString(),
                        payload: [
                          {
                            contentString: "RevenueCat login attempt after registration",
                          },
                          {
                            contentString: JSON.stringify({
                              timestamp: new Date().toISOString(),
                              method: "Purchases.logIn",
                              profileId: profileId,
                              retryCount: retryCount,
                              status: "attempting",
                            }),
                          },
                        ],
                      });
                    } catch (logError) {
                      console.error("Failed to create pre-login log:", logError);
                    }

                    // Try the login - this will fail if not properly initialized
                    await Purchases.logIn(profileId);
                    console.log("RevenueCat login successful after registration");

                    // Create Communication resource log for successful login
                    try {
                      await medplum.createResource({
                        resourceType: "Communication",
                        status: "completed",
                        subject: { reference: `Patient/${profileId}` },
                        about: [{ reference: `Patient/${profileId}` }],
                        sent: new Date().toISOString(),
                        payload: [
                          {
                            contentString: "RevenueCat login successful after registration",
                          },
                          {
                            contentString: JSON.stringify({
                              timestamp: new Date().toISOString(),
                              method: "Purchases.logIn",
                              profileId: profileId,
                              retryCount: retryCount,
                              status: "success",
                            }),
                          },
                        ],
                      });
                    } catch (logError) {
                      console.error("Failed to create post-login log:", logError);
                    }

                    // Force refresh customer info to ensure everything is synced
                    if (typeof Purchases.getCustomerInfo === "function") {
                      try {
                        // Create Communication resource log before customer info fetch
                        try {
                          await medplum.createResource({
                            resourceType: "Communication",
                            status: "completed",
                            subject: { reference: `Patient/${profileId}` },
                            about: [{ reference: `Patient/${profileId}` }],
                            sent: new Date().toISOString(),
                            payload: [
                              {
                                contentString:
                                  "RevenueCat customer info fetch attempt after registration",
                              },
                              {
                                contentString: JSON.stringify({
                                  timestamp: new Date().toISOString(),
                                  method: "Purchases.getCustomerInfo",
                                  profileId: profileId,
                                  status: "attempting",
                                }),
                              },
                            ],
                          });
                        } catch (logError) {
                          console.error("Failed to create pre-customer-info log:", logError);
                        }

                        const customerInfo = await Purchases.getCustomerInfo();
                        console.log("RevenueCat customer info refreshed");

                        // Create Communication resource log for successful customer info fetch
                        try {
                          await medplum.createResource({
                            resourceType: "Communication",
                            status: "completed",
                            subject: { reference: `Patient/${profileId}` },
                            about: [{ reference: `Patient/${profileId}` }],
                            sent: new Date().toISOString(),
                            payload: [
                              {
                                contentString:
                                  "RevenueCat customer info fetch successful after registration",
                              },
                              {
                                contentString: JSON.stringify({
                                  timestamp: new Date().toISOString(),
                                  method: "Purchases.getCustomerInfo",
                                  profileId: profileId,
                                  status: "success",
                                  hasEntitlements: !!customerInfo?.entitlements?.active,
                                  entitlementCount: customerInfo?.entitlements?.active
                                    ? Object.keys(customerInfo.entitlements.active).length
                                    : 0,
                                  entitlements: customerInfo?.entitlements?.active
                                    ? Object.keys(customerInfo.entitlements.active)
                                    : [],
                                }),
                              },
                            ],
                          });
                        } catch (logError) {
                          console.error("Failed to create post-customer-info log:", logError);
                        }
                      } catch (infoError) {
                        console.warn("Failed to refresh customer info:", infoError);

                        // Create Communication resource log for failed customer info fetch
                        try {
                          await medplum.createResource({
                            resourceType: "Communication",
                            status: "completed",
                            subject: { reference: `Patient/${profileId}` },
                            about: [{ reference: `Patient/${profileId}` }],
                            sent: new Date().toISOString(),
                            payload: [
                              {
                                contentString:
                                  "RevenueCat customer info fetch failed after registration",
                              },
                              {
                                contentString: JSON.stringify({
                                  timestamp: new Date().toISOString(),
                                  method: "Purchases.getCustomerInfo",
                                  profileId: profileId,
                                  status: "error",
                                  error:
                                    infoError instanceof Error
                                      ? infoError.message
                                      : String(infoError),
                                }),
                              },
                            ],
                          });
                        } catch (logError) {
                          console.error("Failed to create error-customer-info log:", logError);
                        }
                      }
                    }
                  } catch (error) {
                    console.warn(`RevenueCat login attempt ${retryCount} failed:`, error);

                    // Create Communication resource log for failed login
                    try {
                      await medplum.createResource({
                        resourceType: "Communication",
                        status: "completed",
                        subject: { reference: `Patient/${profileId}` },
                        about: [{ reference: `Patient/${profileId}` }],
                        sent: new Date().toISOString(),
                        payload: [
                          {
                            contentString: "RevenueCat login failed after registration",
                          },
                          {
                            contentString: JSON.stringify({
                              timestamp: new Date().toISOString(),
                              method: "Purchases.logIn",
                              profileId: profileId,
                              retryCount: retryCount,
                              status: "error",
                              error: error instanceof Error ? error.message : String(error),
                            }),
                          },
                        ],
                      });
                    } catch (logError) {
                      console.error("Failed to create login-error log:", logError);
                    }

                    // Retry logic - increase delay with each retry
                    if (retryCount < 2) {
                      const delay = (retryCount + 1) * 2000; // 2s, 4s
                      console.log(`Retrying RevenueCat login in ${delay}ms...`);
                      setTimeout(() => attemptRevenueCatLogin(retryCount + 1), delay);
                    } else {
                      console.error("RevenueCat login failed after multiple retries:", error);
                    }
                  }
                };

                // Start the login attempt process
                attemptRevenueCatLogin();
              }

              setStatus("success");
              setMessage("Registration successful! You are now signed in.");

              // Automatically redirect after a short delay
              setTimeout(() => {
                router.replace("/");
              }, 2000);
            } catch (error) {
              console.error("Auto-login failed:", error);
              setStatus("error");
              setMessage(
                "We couldn't automatically sign you in. Please sign in with your new account.",
              );
            }
          } else {
            // Registration was successful but without auth tokens
            setStatus("success");
            setMessage("Your account has been created successfully. Please sign in.");
          }
        } else {
          // Registration was cancelled or failed
          setStatus("error");
          setMessage("Registration was not completed. Please try again.");
        }
      } catch (error) {
        console.error("Error processing registration callback:", error);
        setStatus("error");
        setMessage("An error occurred while processing your registration. Please try again.");
      }
    };

    processRegistration();
  }, [searchParams, medplum, router]);

  return (
    <Box className="flex-1 items-center justify-center bg-background-50 p-4">
      <VStack space="xl" className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <Text className="text-center text-xl font-bold">
          {status === "loading"
            ? "Processing Registration"
            : status === "success"
              ? "Registration Complete"
              : "Registration Issue"}
        </Text>

        <Text className="text-center">{message}</Text>

        {status !== "loading" && (
          <Button
            action={status === "success" ? "primary" : "secondary"}
            onPress={() => router.replace(status === "success" ? "/" : "/sign-in")}
          >
            <ButtonText>
              {status === "success" ? "Go to Dashboard" : "Return to Sign In"}
            </ButtonText>
          </Button>
        )}
      </VStack>
    </Box>
  );
}
