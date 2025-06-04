import { LoginState } from "@medplum/core";
import { useMedplum } from "@medplum/react-hooks";
import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseError,
  TokenResponse,
} from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Image, Linking, Platform, View } from "react-native";
import Purchases from "react-native-purchases";

import { Button, ButtonText } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/gradient-background";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { oauth2ClientId, oAuth2Discovery } from "@/utils/medplum-oauth2";
import { trackUserAction } from "@/utils/system-logging";

// Based on https://docs.expo.dev/guides/authentication/#calendly
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const router = useRouter();
  const medplum = useMedplum();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const isLoading = isLoginLoading || !medplum.isInitialized;

  const redirectAfterLogin = useCallback(() => {
    // Workaround for disabling back button after login:
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  }, [router]);

  // Helper function to log authentication issues to AuditEvent
  const logAuthError = useCallback(
    async (title: string, details: Record<string, unknown>, success: boolean = true) => {
      try {
        const profile = medplum.getProfile();
        if (profile?.id) {
          await trackUserAction({
            medplum,
            patientId: profile.id,
            action: title,
            details: JSON.stringify(details),
            success,
          });
        } else {
          // Log to console if no profile available
          console.log(`Auth Log: ${title}`, details);
        }
      } catch (error) {
        console.error(`Failed to log auth event "${title}":`, error);
        // Fallback to console logging
        console.log(`Auth Log: ${title}`, details);
      }
    },
    [medplum],
  );

  const processTokenResponse = useCallback(
    async (tokenResponse: TokenResponse) => {
      try {
        // Log token response info (without sensitive data)
        const tokenInfo = {
          hasAccessToken: !!tokenResponse.accessToken,
          hasRefreshToken: !!tokenResponse.refreshToken,
          tokenType: tokenResponse.tokenType,
          expiresIn: tokenResponse.expiresIn,
          scope: tokenResponse.scope,
          timestamp: new Date().toISOString(),
        };

        await logAuthError("Token Response Info", tokenInfo);

        // Check token validity before attempting login
        if (!tokenResponse.accessToken) {
          const error = "Missing access token in response";
          await logAuthError("Token Validation Failed", { error }, false);
          throw new Error(error);
        }

        // Log if refresh token is missing but continue with authentication
        if (!tokenResponse.refreshToken) {
          console.log(
            "No refresh token provided - session will need re-authentication when it expires",
          );
          await logAuthError("Missing Refresh Token", {
            warning:
              "No refresh token provided - session will need re-authentication when it expires",
            timestamp: new Date().toISOString(),
          });
          // Continue with authentication - don't throw an error
        }

        await logAuthError("Setting Active Login", {
          timestamp: new Date().toISOString(),
          status: "attempting",
        });

        // Set active login in Medplum
        await medplum.setActiveLogin({
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
        } as LoginState);

        await logAuthError("Verifying Login", {
          timestamp: new Date().toISOString(),
          status: "checking",
        });

        // Verify login was successful
        const loginState = await medplum.getActiveLogin();

        await logAuthError("Login State Retrieved", {
          hasLoginState: !!loginState,
          hasProfile: !!loginState?.profile,
          timestamp: new Date().toISOString(),
        });

        // Get user profile to use as RevenueCat identifier
        const profile = medplum.getProfile();

        // Add detailed logging about the profile
        await logAuthError("Profile Information", {
          hasProfile: !!profile,
          profileType: profile?.resourceType || "undefined",
          profileId: profile?.id || "undefined",
          timestamp: new Date().toISOString(),
        });

        // Check if we need to fetch the profile explicitly
        if (!profile) {
          try {
            console.log("No profile found, attempting to fetch profile explicitly");
            // Try to explicitly request the profile
            const userDetails = await medplum.getProfileResource();

            await logAuthError("Explicit Profile Fetch Result", {
              success: !!userDetails,
              resourceType: userDetails?.resourceType || "undefined",
              id: userDetails?.id || "undefined",
              timestamp: new Date().toISOString(),
            });
          } catch (fetchErr) {
            console.error("Error fetching profile:", fetchErr);
            await logAuthError(
              "Profile Fetch Error",
              {
                error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
                timestamp: new Date().toISOString(),
              },
              false,
            );
          }
        }

        if (profile?.id) {
          try {
            // Attempt RevenueCat login with more robust retry mechanism
            const attemptRevenueCatLogin = async (retryCount = 0) => {
              try {
                // Check if we're on web (where RevenueCat isn't supported)
                if (Platform.OS === "web") {
                  return await logAuthError("RevenueCat Skipped", {
                    reason: "Web platform not supported",
                    profileId: profile.id,
                    timestamp: new Date().toISOString(),
                  });
                }

                // Basic check for Purchases object
                if (!Purchases) {
                  throw new Error("Purchases object not available");
                }

                // Log what we're doing
                console.log(
                  `📱 [RevenueCat] Attempting login for profile ID: ${profile.id.substring(0, 6)}...`,
                );

                // Check if RevenueCat is configured
                if (typeof Purchases.isConfigured !== "function") {
                  console.warn("📱 [RevenueCat] isConfigured method not available");
                }

                if (typeof Purchases.isConfigured === "function" && !Purchases.isConfigured()) {
                  // Log initialization attempt
                  console.log(
                    "📱 [RevenueCat] Not configured. Attempting on-demand initialization...",
                  );

                  // Try to initialize RevenueCat on-demand if not already configured
                  try {
                    const { ensureRevenueCatInitialized } = await import(
                      "@/utils/subscription/initialize-revenue-cat"
                    );

                    // Get debug info first
                    const { getRevenueCatDebugInfo } = await import(
                      "@/utils/subscription/initialize-revenue-cat"
                    );
                    const debugInfo = getRevenueCatDebugInfo();

                    // Log debug info
                    await logAuthError("RevenueCat debug info before on-demand initialization", {
                      debugInfo,
                      profileId: profile.id,
                      retryCount: retryCount,
                    });

                    // Try initialization - will show alerts internally
                    const initialized = await ensureRevenueCatInitialized(medplum, true);

                    // Log initialization attempt
                    await logAuthError(
                      "RevenueCat on-demand initialization attempt",
                      {
                        success: initialized,
                        profileId: profile.id,
                        retryCount: retryCount,
                      },
                      initialized,
                    );

                    if (!initialized) {
                      const error = "Failed to initialize RevenueCat on-demand";
                      console.error("📱 [RevenueCat] " + error);
                      throw new Error(error);
                    }
                  } catch (initError) {
                    const error = `RevenueCat not configured and on-demand initialization failed: ${initError}`;
                    console.error("📱 [RevenueCat] " + error);
                    throw new Error(error);
                  }
                } else if (
                  typeof Purchases.isConfigured === "function" &&
                  Purchases.isConfigured()
                ) {
                  console.log("📱 [RevenueCat] Already configured! Proceeding with login...");
                }

                // Log login attempt
                await logAuthError("RevenueCat login attempt", {
                  method: "Purchases.logIn",
                  profileId: profile.id,
                  retryCount: retryCount,
                  status: "attempting",
                });

                // Log pre-login message
                console.log("📱 [RevenueCat] Executing Purchases.logIn() now...");

                // Try the login - this will fail if not properly initialized
                try {
                  await Purchases.logIn(profile.id);
                  console.log("📱 [RevenueCat] Login successful!");
                } catch (loginErr) {
                  console.error("📱 [RevenueCat] Login Error:", String(loginErr));
                  throw loginErr; // Re-throw to be caught by the outer try/catch
                }

                // Log successful login
                await logAuthError("RevenueCat login successful", {
                  method: "Purchases.logIn",
                  profileId: profile.id,
                  retryCount: retryCount,
                  status: "success",
                });

                await logAuthError("RevenueCat Login", {
                  success: true,
                  profileId: profile.id,
                  retryCount,
                  timestamp: new Date().toISOString(),
                });

                // Force refresh customer info to ensure everything is synced
                if (typeof Purchases.getCustomerInfo === "function") {
                  try {
                    // Log customer info fetch attempt
                    await logAuthError("RevenueCat customer info fetch attempt", {
                      method: "Purchases.getCustomerInfo",
                      profileId: profile.id,
                      status: "attempting",
                    });

                    const customerInfo = await Purchases.getCustomerInfo();

                    // Log successful customer info fetch
                    await logAuthError("RevenueCat customer info fetch successful", {
                      method: "Purchases.getCustomerInfo",
                      profileId: profile.id,
                      status: "success",
                      hasEntitlements: !!customerInfo?.entitlements?.active,
                      entitlementCount: customerInfo?.entitlements?.active
                        ? Object.keys(customerInfo.entitlements.active).length
                        : 0,
                      entitlements: customerInfo?.entitlements?.active
                        ? Object.keys(customerInfo.entitlements.active)
                        : [],
                    });

                    await logAuthError("RevenueCat CustomerInfo", {
                      success: true,
                      hasCustomerInfo: !!customerInfo,
                      entitlements: customerInfo?.entitlements?.active
                        ? Object.keys(customerInfo.entitlements.active)
                        : [],
                      timestamp: new Date().toISOString(),
                    });
                  } catch (infoError) {
                    console.warn("Failed to refresh customer info:", infoError);

                    // Log failed customer info fetch
                    await logAuthError(
                      "RevenueCat customer info fetch failed",
                      {
                        method: "Purchases.getCustomerInfo",
                        profileId: profile.id,
                        status: "error",
                        error: infoError instanceof Error ? infoError.message : String(infoError),
                      },
                      false,
                    );
                  }
                }
              } catch (error) {
                console.warn(`RevenueCat login attempt ${retryCount} failed:`, error);

                // Log failed login
                await logAuthError(
                  "RevenueCat login failed",
                  {
                    method: "Purchases.logIn",
                    profileId: profile.id,
                    retryCount: retryCount,
                    status: "error",
                    error: error instanceof Error ? error.message : String(error),
                  },
                  false,
                );

                // Retry logic - increase delay with each retry
                if (retryCount < 2) {
                  const delay = (retryCount + 1) * 2000; // 2s, 4s
                  console.log(`Retrying RevenueCat login in ${delay}ms...`);

                  await logAuthError(
                    "RevenueCat Login Retry",
                    {
                      error: error instanceof Error ? error.message : String(error),
                      profileId: profile.id,
                      retryCount,
                      nextRetryDelay: delay,
                      timestamp: new Date().toISOString(),
                    },
                    false,
                  );

                  setTimeout(() => attemptRevenueCatLogin(retryCount + 1), delay);
                } else {
                  await logAuthError(
                    "RevenueCat Login Failed",
                    {
                      error: error instanceof Error ? error.message : String(error),
                      profileId: profile.id,
                      retriesExhausted: true,
                      timestamp: new Date().toISOString(),
                    },
                    false,
                  );
                }
              }
            };

            // Start the login attempt process
            attemptRevenueCatLogin();
          } catch (error) {
            await logAuthError(
              "RevenueCat Login Failed",
              {
                error: error instanceof Error ? error.message : String(error),
                profileId: profile.id,
                timestamp: new Date().toISOString(),
              },
              false,
            );
            // Don't block the login process if RevenueCat fails
          }
        } else {
          await logAuthError("RevenueCat Login Skipped", {
            reason: "No profile ID available",
            timestamp: new Date().toISOString(),
          });
        }

        // Add a diagnostic log entry
        await logAuthError("DIAGNOSTIC LOG: Testing AuditEvent Resource Creation", {
          test: "This is a test entry to verify AuditEvent resource creation",
          platform: Platform.OS,
        });

        redirectAfterLogin();
      } catch (error) {
        // Log detailed error information
        const errorDetails = {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        };

        await logAuthError("Token Processing Failed", errorDetails, false);
        console.error("Error processing token response:", error);
        Alert.alert("Authentication Error", "Failed to complete login process. Please try again.");
      }
    },
    [medplum, redirectAfterLogin, logAuthError],
  );

  const medplumLogin = useCallback(async () => {
    // Build the redirect URI and log it
    const redirectUri = makeRedirectUri();

    console.log("==== OAUTH CONFIG ====");
    console.log("Redirect URI:", redirectUri);
    console.log("Client ID:", oauth2ClientId);
    console.log("Auth endpoint:", oAuth2Discovery.authorizationEndpoint);
    console.log("Token endpoint:", oAuth2Discovery.tokenEndpoint);
    console.log("=====================");

    await logAuthError("Starting Login Flow", {
      oauth2ClientId,
      redirectUri,
      authorizationEndpoint: oAuth2Discovery.authorizationEndpoint,
      tokenEndpoint: oAuth2Discovery.tokenEndpoint,
      timestamp: new Date().toISOString(),
    });

    const loginRequest = new AuthRequest({
      clientId: oauth2ClientId,
      usePKCE: true,
      // Redirect URI must match Medplum config, see README.md
      redirectUri: redirectUri,
      scopes: ["openid"], // Using only openid scope to avoid consent screen
    });

    let loginResponse;
    try {
      // Build the authorization URL to log it
      const authUrl = await loginRequest.makeAuthUrlAsync(oAuth2Discovery);
      console.log("==== FULL AUTH URL ====");
      console.log(authUrl);
      console.log("=======================");
      
      await logAuthError("Prompt Auth Request", {
        status: "starting",
        authUrl: authUrl,
        timestamp: new Date().toISOString(),
      });

      loginResponse = await loginRequest.promptAsync(oAuth2Discovery);

      await logAuthError("Auth Prompt Response", {
        type: loginResponse.type,
        hasCode: loginResponse.type === "success" && !!loginResponse.params?.code,
        hasError: loginResponse.type === "success" && !!loginResponse.params?.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };

      await logAuthError("Auth Prompt Error", errorDetails, false);

      if (error instanceof Error) {
        console.error("Auth prompt error:", error.message);
        Alert.alert("Authentication error", "Unable to start sign-in process. Please try again.");
        if (__DEV__) {
          console.error(error);
        }
      }
      return;
    }

    if (loginResponse.type === "dismiss" || loginResponse.type === "cancel") {
      // User cancelled the authentication - this is normal behavior, don't show an error
      await logAuthError("Auth Cancelled", {
        reason: "User cancelled authentication flow",
        timestamp: new Date().toISOString(),
      });
      console.log("User cancelled authentication");
      return;
    }

    if (loginResponse.type === "error") {
      const errorDetails = {
        error: loginResponse.params?.error || "Unknown error",
        error_description: loginResponse.params?.error_description || "Authentication failed",
        timestamp: new Date().toISOString(),
      };

      await logAuthError("Auth Response Error", errorDetails, false);

      console.error(
        "Auth response error:",
        loginResponse.params?.error_description || "Unknown error",
      );
      Alert.alert("Sign In Cancelled", "You can try signing in again when you're ready.");
      if (__DEV__) {
        console.error(loginResponse.params?.error_description);
      }
      return;
    }

    if (loginResponse.type === "success") {
      try {
        await logAuthError("Token Exchange Request", {
          status: "starting",
          hasCode: !!loginResponse.params.code,
          hasCodeVerifier: !!loginRequest.codeVerifier,
          timestamp: new Date().toISOString(),
        });

        const tokenResponse = await exchangeCodeAsync(
          {
            clientId: oauth2ClientId,
            code: loginResponse.params.code,
            redirectUri: loginRequest.redirectUri,
            extraParams: {
              code_verifier: loginRequest.codeVerifier!,
            },
          },
          oAuth2Discovery,
        );

        // Show the token response details on screen - hide sensitive parts
        const logSafeResponse = {
          hasAccessToken: !!tokenResponse.accessToken,
          accessTokenLength: tokenResponse.accessToken?.length,
          hasRefreshToken: !!tokenResponse.refreshToken,
          refreshTokenLength: tokenResponse.refreshToken?.length,
          tokenType: tokenResponse.tokenType,
          expiresIn: tokenResponse.expiresIn,
          scope: tokenResponse.scope,
          state: tokenResponse.state,
          issuedAt: tokenResponse.issuedAt,
          idToken: tokenResponse.idToken ? "present" : "missing",
        };

        console.log("TOKEN RESPONSE:", JSON.stringify(logSafeResponse, null, 2));

        await logAuthError("Token Exchange Success", {
          status: "success",
          responseDetails: logSafeResponse,
          timestamp: new Date().toISOString(),
        });

        await processTokenResponse(tokenResponse);
      } catch (error) {
        const errorDetails = {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : "Unknown",
          code: error instanceof ResponseError ? error.code : undefined,
          description: error instanceof ResponseError ? error.description : undefined,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        };

        await logAuthError("Token Exchange Error", errorDetails, false);

        console.error("Token exchange error:", error);

        if (error instanceof ResponseError) {
          if (
            error.code === "invalid_request" &&
            error.description?.includes("Invalid code verifier")
          ) {
            // If the user tries to login right after unsuccessfully logging out,
            // the server returns an invalid_request error.
            // We can ignore and try again:
            await logAuthError(
              "Invalid Code Verifier",
              {
                status: "retrying",
                timestamp: new Date().toISOString(),
              },
              false,
            );

            console.log("Invalid code verifier, retrying login");
            return medplumLogin();
          }
          console.error("Response error details:", {
            code: error.code,
            description: error.description,
          });
          Alert.alert("Authentication error", "Sign-in was unsuccessful. Please try again.");
          if (__DEV__) {
            console.error(error);
          }
        }
      }
    }
  }, [processTokenResponse, logAuthError]);

  const handleLogin = useCallback(() => {
    setIsLoginLoading(true);
    medplumLogin().finally(() => setIsLoginLoading(false));
  }, [medplumLogin]);

  // Note: Currently unused but kept for potential future registration flow changes
  // Registration callbacks are handled by _layout.tsx (mobile deep links) and register-callback.tsx (web)
  const handleRegisterSuccess = useCallback(() => {
    // Registration automatically logs the user in, so just redirect
    redirectAfterLogin();
  }, [redirectAfterLogin]);

  // Direct registration handler - launches browser immediately
  const handleCreateAccount = useCallback(async () => {
    try {
      // Base URL for the web registration page
      const registrationUrl = "https://www.feelheard.me/register";

      // Choose appropriate redirect URI based on platform
      let redirectUri;

      if (Platform.OS === "web") {
        // For web, use the current origin with a callback path
        const origin = window.location.origin;
        redirectUri = `${origin}/register-callback`;
      } else {
        // For mobile, use the deep link scheme
        redirectUri = "feelheard://register";
      }

      // Construct the full URL with redirect
      const fullUrl = `${registrationUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log("Registration URL:", fullUrl);

      // Launch browser registration
      if (Platform.OS === "web") {
        window.open(fullUrl, "_blank");
      } else {
        try {
          console.log("Opening browser for registration");
          await WebBrowser.openBrowserAsync(fullUrl);
        } catch (browserError) {
          console.error("WebBrowser.openBrowserAsync failed:", browserError);

          try {
            // Fallback to WebBrowser.openAuthSessionAsync which handles redirects better
            console.log("Attempting WebBrowser.openAuthSessionAsync as fallback");
            await WebBrowser.openAuthSessionAsync(fullUrl, "feelheard://register");
          } catch (authSessionError) {
            console.error("WebBrowser.openAuthSessionAsync failed:", authSessionError);

            // Last resort: try standard Linking
            console.log("Attempting Linking.openURL as last resort");
            await Linking.openURL(fullUrl);
          }
        }
      }
    } catch (error) {
      console.error("Error opening browser for registration:", error);
      Alert.alert(
        "Browser Error",
        "Unable to open your browser. Please try again or register directly at www.feelheard.me",
      );
    }
  }, []);

  return (
    <GradientBackground variant="primary">
      <View className="flex-1">
        <Image
          source={require("@/assets/images/two-hearts-gradient.png")}
          style={{
            width: "100%",
            height: 350,
          }}
          resizeMode="cover"
        />
        <View className="flex-1 items-center justify-center px-6">
          {isLoading && <Spinner size="large" color="white" />}
          {!isLoading && (
            <VStack space="lg" className="w-full max-w-[350px] items-center">
              <Text className="mb-1 text-center text-3xl font-bold text-white">
                Welcome to FeelHeard.me
              </Text>
              <Text className="mb-8 text-center text-lg font-medium text-white/90">
                Your AI-powered emotional support companion
              </Text>
              <Button
                action="primary"
                size="lg"
                onPress={handleLogin}
                className="mb-4 h-14 w-full rounded-full bg-white/90 shadow-lg"
              >
                <ButtonText className="text-lg font-bold text-primary-700">Sign In</ButtonText>
              </Button>
              <Button
                action="secondary"
                variant="outline"
                size="lg"
                onPress={handleCreateAccount}
                className="h-14 w-full rounded-full border-white/50"
              >
                <ButtonText className="text-lg font-semibold text-white">Create Account</ButtonText>
              </Button>
            </VStack>
          )}
        </View>
      </View>
    </GradientBackground>
  );
}
