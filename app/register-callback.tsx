import { useMedplum } from "@medplum/react-hooks";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
                try {
                  await Purchases.logIn(profileId);
                } catch (rcError) {
                  console.error("Error linking with RevenueCat:", rcError);
                  // Continue even if RevenueCat fails - non-critical
                }
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
