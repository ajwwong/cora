import React, { useEffect } from "react";
import { NativeModules, Platform } from "react-native";
import Purchases from "react-native-purchases";

import { REVENUE_CAT_API_KEYS } from "./utils/subscription/config";

export const DebugRevenueCat: React.FC = () => {
  useEffect(() => {
    const testRevenueCat = async () => {
      console.log("=== REVENUECAT DEBUG TEST ===");

      // 1. Check basic imports
      console.log("1. Purchases object:", typeof Purchases);
      console.log("2. Platform:", Platform.OS);

      // 2. Check native modules
      console.log("3. NativeModules.RNPurchases exists:", !!NativeModules.RNPurchases);
      if (NativeModules.RNPurchases) {
        console.log(
          "4. RNPurchases properties:",
          Object.getOwnPropertyNames(NativeModules.RNPurchases),
        );
      }

      // 3. Check API key
      const apiKey =
        Platform.OS === "ios" ? REVENUE_CAT_API_KEYS.ios : REVENUE_CAT_API_KEYS.android;
      console.log("5. API key prefix:", apiKey.substring(0, 10) + "...");

      // 4. Check Purchases methods
      console.log("6. Purchases.configure exists:", typeof Purchases.configure);
      console.log("7. Purchases.isConfigured exists:", typeof Purchases.isConfigured);

      try {
        // 5. Try simple configuration
        console.log("8. Attempting to configure...");
        Purchases.configure({ apiKey });
        console.log("9. ✅ Configuration successful!");

        // 6. Check if configured
        if (typeof Purchases.isConfigured === "function") {
          console.log("10. Is configured:", Purchases.isConfigured());
        }

        // 7. Try basic method
        console.log("11. Attempting getCustomerInfo...");
        const customerInfo = await Purchases.getCustomerInfo();
        console.log("12. ✅ Customer info retrieved:", !!customerInfo);
      } catch (error) {
        console.error("❌ ERROR at step:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
      }
    };

    // Run after 1 second delay
    setTimeout(testRevenueCat, 1000);
  }, []);

  return null;
};
