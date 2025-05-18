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
import { Alert, Platform, View } from "react-native";
import Purchases from "react-native-purchases";

import { Button, ButtonText } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/gradient-background";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { WebRegistration } from "@/components/WebRegistration";
import { oauth2ClientId, oAuth2Discovery } from "@/utils/medplum-oauth2";

// Based on https://docs.expo.dev/guides/authentication/#calendly
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const router = useRouter();
  const medplum = useMedplum();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const isLoading = isLoginLoading || !medplum.isInitialized;

  const redirectAfterLogin = useCallback(() => {
    // Workaround for disabling back button after login:
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  }, [router]);

  // Helper function to log authentication issues to console only
  const logAuthError = useCallback((title: string, details: Record<string, unknown>) => {
    // Log to console instead of creating Communication resources
    console.log(`Auth Log: ${title}`, details);
  }, []);

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

        logAuthError("Token Response Info", tokenInfo);

        // Check token validity before attempting login
        if (!tokenResponse.accessToken) {
          const error = "Missing access token in response";
          logAuthError("Token Validation Failed", { error });
          throw new Error(error);
        }

        // Log if refresh token is missing but continue with authentication
        if (!tokenResponse.refreshToken) {
          console.log(
            "No refresh token provided - session will need re-authentication when it expires",
          );
          logAuthError("Missing Refresh Token", {
            warning:
              "No refresh token provided - session will need re-authentication when it expires",
            timestamp: new Date().toISOString(),
          });
          // Continue with authentication - don't throw an error
        }

        logAuthError("Setting Active Login", {
          timestamp: new Date().toISOString(),
          status: "attempting",
        });

        // Set active login in Medplum
        await medplum.setActiveLogin({
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
        } as LoginState);

        logAuthError("Verifying Login", {
          timestamp: new Date().toISOString(),
          status: "checking",
        });

        // Verify login was successful
        const loginState = await medplum.getActiveLogin();

        logAuthError("Login State Retrieved", {
          hasLoginState: !!loginState,
          hasProfile: !!loginState?.profile,
          timestamp: new Date().toISOString(),
        });

        // Get user profile to use as RevenueCat identifier
        const profile = medplum.getProfile();

        // Add detailed logging about the profile
        logAuthError("Profile Information", {
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

            logAuthError("Explicit Profile Fetch Result", {
              success: !!userDetails,
              resourceType: userDetails?.resourceType || "undefined",
              id: userDetails?.id || "undefined",
              timestamp: new Date().toISOString(),
            });
          } catch (fetchErr) {
            console.error("Error fetching profile:", fetchErr);
            logAuthError("Profile Fetch Error", {
              error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (profile?.id) {
          try {
            // Safely check if RevenueCat is available and properly initialized
            const isRevenueCatAvailable = () => {
              try {
                // Check if we're on web (where RevenueCat isn't supported)
                if (Platform.OS === "web") {
                  return false;
                }

                // Check if the Purchases object exists and has necessary methods
                if (!Purchases || typeof Purchases.logIn !== "function") {
                  return false;
                }

                // Try to call a method that would fail if not configured
                if (typeof Purchases.getAppUserID === "function") {
                  try {
                    Purchases.getAppUserID();
                    return true;
                  } catch {
                    // If this throws, it's not properly configured
                    return false;
                  }
                }

                return false;
              } catch {
                // Any error means RevenueCat isn't properly available
                return false;
              }
            };

            if (isRevenueCatAvailable()) {
              // Log in to RevenueCat with the user's Medplum ID
              await Purchases.logIn(profile.id);
              logAuthError("RevenueCat Login", {
                success: true,
                profileId: profile.id,
                timestamp: new Date().toISOString(),
              });
            } else {
              console.log("RevenueCat not configured, skipping login");
              logAuthError("RevenueCat Skipped", {
                reason: "Not configured or initialized",
                profileId: profile.id,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (error) {
            logAuthError("RevenueCat Login Failed", {
              error: error instanceof Error ? error.message : String(error),
              profileId: profile.id,
              timestamp: new Date().toISOString(),
            });
            // Don't block the login process if RevenueCat fails
          }
        } else {
          logAuthError("RevenueCat Login Skipped", {
            reason: "No profile ID available",
            timestamp: new Date().toISOString(),
          });
        }

        redirectAfterLogin();
      } catch (error) {
        // Log detailed error information
        const errorDetails = {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        };

        logAuthError("Token Processing Failed", errorDetails);
        console.error("Error processing token response:", error);
        Alert.alert(
          "Authentication Error",
          `Failed to complete login process. Please try again. (${errorDetails.message})`,
        );
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

    try {
      await logAuthError("Starting Login Flow", {
        oauth2ClientId,
        redirectUri,
        authorizationEndpoint: oAuth2Discovery.authorizationEndpoint,
        tokenEndpoint: oAuth2Discovery.tokenEndpoint,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Could not log auth start:", err);
    }

    const loginRequest = new AuthRequest({
      clientId: oauth2ClientId,
      usePKCE: true,
      // Redirect URI must match Medplum config, see README.md
      redirectUri: redirectUri,
      scopes: ["openid"], // Using only openid scope to avoid consent screen
    });

    let loginResponse;
    try {
      logAuthError("Prompt Auth Request", {
        status: "starting",
        timestamp: new Date().toISOString(),
      });

      loginResponse = await loginRequest.promptAsync(oAuth2Discovery);

      logAuthError("Auth Prompt Response", {
        type: loginResponse.type,
        hasCode: loginResponse.type === "success" && !!loginResponse.params.code,
        hasError: !!loginResponse.params.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };

      logAuthError("Auth Prompt Error", errorDetails);

      if (error instanceof Error) {
        console.error("Auth prompt error:", error.message);
        Alert.alert("Authentication error", error.message);
        if (__DEV__) {
          console.error(error);
        }
      }
      return;
    }

    if (loginResponse.type === "error") {
      const errorDetails = {
        error: loginResponse.params.error,
        error_description: loginResponse.params.error_description,
        timestamp: new Date().toISOString(),
      };

      logAuthError("Auth Response Error", errorDetails);

      console.error(
        "Auth response error:",
        loginResponse.params.error_description || "Unknown error",
      );
      Alert.alert(
        "Authentication error",
        loginResponse.params.error_description || "something went wrong",
      );
      if (__DEV__) {
        console.error(loginResponse.params.error_description);
      }
      return;
    }

    if (loginResponse.type === "success") {
      try {
        logAuthError("Token Exchange Request", {
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

        logAuthError("Token Exchange Success", {
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

        logAuthError("Token Exchange Error", errorDetails);

        console.error("Token exchange error:", error);

        if (error instanceof ResponseError) {
          if (
            error.code === "invalid_request" &&
            error.description?.includes("Invalid code verifier")
          ) {
            // If the user tries to login right after unsuccessfully logging out,
            // the server returns an invalid_request error.
            // We can ignore and try again:
            logAuthError("Invalid Code Verifier", {
              status: "retrying",
              timestamp: new Date().toISOString(),
            });

            console.log("Invalid code verifier, retrying login");
            return medplumLogin();
          }
          console.error("Response error details:", {
            code: error.code,
            description: error.description,
          });
          Alert.alert("Authentication error", error.message);
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

  const handleRegisterSuccess = useCallback(() => {
    // Registration automatically logs the user in, so just redirect
    redirectAfterLogin();
  }, [redirectAfterLogin]);

  const toggleRegistration = useCallback(() => {
    setShowRegister((prev) => !prev);
  }, []);

  return (
    <GradientBackground variant="primary">
      <View className="flex-1 items-center justify-center">
        {isLoading && <Spinner size="large" color="white" />}
        {!isLoading && !showRegister && (
          <VStack space="lg" className="w-[90%] max-w-[350px] items-center">
            <View className="w-full items-center rounded-xl bg-white/10 backdrop-blur-md p-8 shadow-md">
              <Text className="text-center text-3xl font-bold text-white mb-1">Welcome to FeelHeard.me</Text>
              <Text className="mb-8 text-center text-lg font-medium text-white/90">Your AI-powered emotional support companion</Text>
              <Button 
                action="primary" 
                size="lg" 
                onPress={handleLogin}
                className="w-full bg-white/90 mb-4 rounded-full h-14 shadow-lg"
              >
                <ButtonText className="text-primary-700 font-bold text-lg">Sign In</ButtonText>
              </Button>
              <Button 
                action="secondary" 
                variant="outline" 
                size="lg" 
                onPress={toggleRegistration}
                className="w-full border-white/50 rounded-full h-14"
              >
                <ButtonText className="text-white font-semibold text-lg">Create Account</ButtonText>
              </Button>
            </View>
          </VStack>
        )}
        {!isLoading && showRegister && (
          <View className="w-[90%] max-w-[350px]">
            <WebRegistration onSuccess={handleRegisterSuccess} onCancel={toggleRegistration} />
          </View>
        )}
      </View>
    </GradientBackground>
  );
}
