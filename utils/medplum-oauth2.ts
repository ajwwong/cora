import { Platform } from "react-native";

// Added fallback values to prevent undefined client_id in StackBlitz and other environments
export const oauth2ClientId =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_MEDPLUM_WEB_CLIENT_ID || "01965b46-a832-7301-a0ce-96efc842b6f4"
    : process.env.EXPO_PUBLIC_MEDPLUM_NATIVE_CLIENT_ID || "01965b47-c26d-73fb-a8bf-b5fb77c28816";

// Medplum project ID for registration
export const medplumProjectId =
  process.env.EXPO_PUBLIC_MEDPLUM_PROJECT_ID || "748ccc23-13ca-4e47-8bfb-df2c8cee8a11";

export const oAuth2Discovery = {
  authorizationEndpoint: "https://api.progressnotes.app/oauth2/authorize",
  tokenEndpoint: "https://api.progressnotes.app/oauth2/token",
  userInfoEndpoint: "https://api.progressnotes.app/oauth2/userinfo",
  //  authorizationEndpoint: "https://api.medplum.com/oauth2/authorize",
  //  tokenEndpoint: "https://api.medplum.com/oauth2/token",
  //  userInfoEndpoint: "https://api.medplum.com/oauth2/userinfo",
};
