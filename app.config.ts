import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FeelHeard",
  slug: "feelheard-me",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "feelheard",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  jsEngine: "hermes",
  platforms: ["android", "ios", "web"],
  notification: {
    androidMode: "collapse",
    androidCollapsedTitle: "New messages",
  },
  ios: {
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
    },
    bundleIdentifier: "me.feelheard",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.USE_FULL_SCREEN_INTENT",
    ],
    package: "me.feelheard",
    googleServicesFile: "./google-services.json",
    edgeToEdgeEnabled: true,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-secure-store",
      {
        requireAuthentication: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "The app needs media access when you want to attach media to your messages.",
        cameraPermission:
          "The app needs camera access when you want to attach media to your messages.",
        microphonePermission:
          "The app needs microphone access when you want to attach media to your messages.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "The app needs microphone access to record audio messages.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/adaptive-icon.png",
        color: "#ffffff",
      },
    ],
    // Add build properties plugin for RevenueCat compatibility
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24, // Required by RevenueCat
        }
      },
    ],
    // RevenueCat is initialized in code rather than as a plugin
    // Plugin doesn't seem to be compatible with this version of Expo
    "expo-web-browser",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "222a9bab-0916-46bd-82f9-760a0ccd59d3",
    },
  },
});
