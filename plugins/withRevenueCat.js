const { withMainApplication, withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Expo config plugin to add RevenueCat initialization to MainApplication.kt and build.gradle
 */
function withRevenueCat(config) {
  // First add the build.gradle dependencies
  config = withAppBuildGradle(config, (config) => {
    const { modResults } = config;

    // Add RevenueCat SDK dependencies if not already present
    if (!modResults.contents.includes("com.revenuecat.purchases:purchases:")) {
      modResults.contents = modResults.contents.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")
    
    // RevenueCat SDK for native initialization
    implementation("com.revenuecat.purchases:purchases:8.10.0")
    implementation("com.revenuecat.purchases:purchases-ui:8.10.0")`,
      );
    }

    return config;
  });

  // Then add the MainApplication.kt changes
  return withMainApplication(config, (config) => {
    const { modResults } = config;

    // Add imports
    if (!modResults.contents.includes("import com.revenuecat.purchases.LogLevel")) {
      modResults.contents = modResults.contents.replace(
        "import expo.modules.ReactNativeHostWrapper",
        `import expo.modules.ReactNativeHostWrapper

// RevenueCat imports
import android.util.Log
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration`,
      );
    }

    // Add initialization call in onCreate
    if (!modResults.contents.includes("initializeRevenueCat()")) {
      modResults.contents = modResults.contents.replace(
        "ApplicationLifecycleDispatcher.onApplicationCreate(this)",
        `ApplicationLifecycleDispatcher.onApplicationCreate(this)
    
    // Initialize RevenueCat early to ensure native module is ready
    initializeRevenueCat()`,
      );
    }

    // Add initialization method
    if (!modResults.contents.includes("private fun initializeRevenueCat()")) {
      modResults.contents = modResults.contents.replace(
        "override fun onConfigurationChanged(newConfig: Configuration) {",
        `private fun initializeRevenueCat() {
    try {
      // Set log level to verbose for debugging
      Purchases.logLevel = LogLevel.VERBOSE
      
      // Configure RevenueCat with API key from config
      val revenueCatApiKey = "goog_ocxwCYOseIPqHeYRlHAuuaIAWBo" // Google Play key from config.ts
      val configuration = PurchasesConfiguration.Builder(this, revenueCatApiKey).build()
      Purchases.configure(configuration)
      
      Log.d("RevenueCat", "Successfully initialized RevenueCat in MainApplication.kt")
    } catch (e: Exception) {
      Log.e("RevenueCat", "Failed to initialize RevenueCat in MainApplication.kt", e)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {`,
      );
    }

    return config;
  });
}

module.exports = withRevenueCat;
