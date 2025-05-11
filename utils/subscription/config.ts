/**
 * Configuration for RevenueCat subscription service
 */

export enum PurchaseType {
  PREMIUM_MONTHLY = "premium_monthly",
  PREMIUM_ANNUAL = "premium_annual",
}

/**
 * Product IDs for iOS and Android platforms
 * These are configured in App Store Connect and Google Play Console
 */
export const PRODUCT_IDS = {
  [PurchaseType.PREMIUM_MONTHLY]: {
    ios: "feelheard_premium:monthly-autorenewing",
    android: "feelheard_premium:monthly-autorenewing",
  },
  [PurchaseType.PREMIUM_ANNUAL]: {
    ios: "feelheard_premium:annual-autorenewing",
    android: "feelheard_premium:annual-autorenewing",
  },
};

/**
 * RevenueCat API keys
 */
export const REVENUE_CAT_API_KEYS = {
  ios: "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo", // Using Google key for iOS as well while in development
  android: "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo", // Actual Google API key
};

/**
 * RevenueCat App ID
 */
export const REVENUE_CAT_APP_ID = "app3e20afa061";

/**
 * Entitlement IDs in RevenueCat dashboard
 */
export const ENTITLEMENT_IDS = {
  PREMIUM: "premium", // Main entitlement for Voice Connect features
};

/**
 * FHIR extension URL for storing subscription status
 */
export const SUBSCRIPTION_STATUS_EXTENSION_URL =
  "https://progressnotes.app/fhir/StructureDefinition/subscription-status";

/**
 * Maximum number of voice messages allowed per day on free tier
 */
export const FREE_DAILY_VOICE_MESSAGE_LIMIT = 10;
