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
    ios: "fh_1999_1m", // App Store Connect product ID
    android: "feelheard_premium:monthly-autorenewing", // Google Play product ID
  },
  [PurchaseType.PREMIUM_ANNUAL]: {
    ios: "fh_18999_1y", // App Store Connect product ID
    android: "feelheard_premium:annual-autorenewing", // Google Play product ID
  },
};

/**
 * RevenueCat API keys
 *
 * IMPORTANT: These keys should match your RevenueCat project's production keys
 * - iOS keys start with "appl_"
 * - Android keys start with "goog_"
 * - For development and testing use the same keys, for production use only production keys
 */
export const REVENUE_CAT_API_KEYS = {
  ios: "appl_EhZpZQEfVCtlalbFExbKnpsrUOl", // Production Apple App Store key
  android: "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo", // Production Google Play key
};

/**
 * RevenueCat App IDs
 * Note: Different app IDs for each platform in RevenueCat dashboard
 */
export const REVENUE_CAT_APP_IDS = {
  ios: "app34f0ee7c4b", // iOS App Store app ID
  android: "app3e20afa061", // Google Play app ID
};

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
