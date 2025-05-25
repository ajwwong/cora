/**
 * Test configuration for RevenueCat - minimal setup to verify API keys work
 */

// Test with just the Android key first (since it looks valid)
export const TEST_REVENUE_CAT_CONFIG = {
  // Use the Android key that appears to be real
  androidApiKey: "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo",

  // Placeholder iOS key - this will fail but helps isolate the issue
  iosApiKey: "appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

  // Simple entitlement for testing
  testEntitlement: "premium",

  // Enable verbose logging
  enableDebugLogs: true,
};

export const getTestApiKey = (platform: string) => {
  return platform === "ios"
    ? TEST_REVENUE_CAT_CONFIG.iosApiKey
    : TEST_REVENUE_CAT_CONFIG.androidApiKey;
};
