const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Expo config plugin to add release signing configuration to build.gradle
 */
function withSigningConfig(config) {
  return withAppBuildGradle(config, (config) => {
    const { modResults } = config;

    // Add keystore properties loading at the top
    if (!modResults.contents.includes("keystorePropertiesFile")) {
      modResults.contents = modResults.contents.replace(
        /def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)/,
        `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

// Load keystore properties
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}`
      );
    }

    // Add release signing config to signingConfigs
    if (!modResults.contents.includes("signingConfigs.release")) {
      modResults.contents = modResults.contents.replace(
        /signingConfigs\s*\{\s*debug\s*\{[^}]*\}\s*\}/,
        `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }`
      );
    }

    // Update release buildType to use release signing
    if (modResults.contents.includes("signingConfig signingConfigs.debug") && 
        modResults.contents.includes("buildTypes")) {
      modResults.contents = modResults.contents.replace(
        /release\s*\{[^}]*signingConfig\s+signingConfigs\.debug[^}]*\}/s,
        `release {
            signingConfig signingConfigs.release
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            crunchPngs (findProperty('android.enablePngCrunchInReleaseBuilds')?.toBoolean() ?: true)
        }`
      );
    }

    return config;
  });
}

module.exports = withSigningConfig;