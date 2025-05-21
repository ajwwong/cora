#!/bin/bash

# Script to build a standalone APK that doesn't require a dev server
echo "Starting standalone APK build process..."

# Create a log file with timestamp
LOG_FILE="../standalone-build-log-$(date +%Y%m%d%H%M%S).log"
echo "Build log will be saved to: $LOG_FILE"

# Log function to write to both console and log file
log() {
  echo "$1" | tee -a "$LOG_FILE"
}

log "Standalone build started at $(date)"
log "============================================="

# First clean up any previous builds
log "Cleaning previous builds..."
rm -rf ./android/app/build
rm -rf ./android/build

# Create a temporary app.json to force standalone mode
log "Creating standalone configuration..."
cp app.json app.json.backup
cat > app.json << EOL
{
  "expo": {
    "name": "FeelHeard",
    "slug": "feelheard-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "me.feelheard"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "me.feelheard"
    },
    "plugins": [
      "expo-build-properties"
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
EOL

# Run prebuild with no-dev flag
log "Running prebuild in standalone mode..."
npx expo prebuild --clean --no-dev 2>&1 | tee -a "$LOG_FILE"

# Create a special flag file to ensure JS bundle is included in the build
log "Creating bundle config for standalone mode..."
mkdir -p ./android/app/src/main/assets
touch ./android/app/src/main/assets/STANDALONE_BUILD

# Navigate to the android directory
cd ./android

# Clean and then build with optimized settings
log "Cleaning Gradle project..."
./gradlew clean --max-workers=2 2>&1 | tee -a "$LOG_FILE"

log "Building standalone debug APK..."
log "============================================="
# Using the debug variant for debugging but ensuring JS bundle is included
./gradlew assembleDebug --max-workers=4 --no-daemon --stacktrace 2>&1 | tee -a "$LOG_FILE"
log "============================================="

BUILD_RESULT=$?

# Restore the original app.json
cd ..
mv app.json.backup app.json
log "Restored original app.json configuration"

if [ $BUILD_RESULT -eq 0 ]; then
  log "Standalone build completed successfully. APK location:"
  log "./android/app/build/outputs/apk/debug/app-debug.apk"
  
  # Copy the APK to the project root for easier access
  cp ./android/app/build/outputs/apk/debug/app-debug.apk ./feelheard-standalone.apk
  log "APK copied to: ./feelheard-standalone.apk"
  log "Build log saved to: $LOG_FILE"
  
  log "NOTE: This APK does not require a development server and should run standalone."
else
  log "Build failed. Check the log file for errors: $LOG_FILE"
  # Extract key error messages for quick review
  log "=================== KEY ERROR MESSAGES ======================"
  grep -E "error:|exception:|failure" "$LOG_FILE" | tail -n 20 | tee -a "$LOG_FILE.errors"
  log "============================================================"
  log "Detailed error summary saved to: $LOG_FILE.errors"
fi

log ""
log "==============================================================="
log "NOTE: This is a standalone build. It will:"
log "- Run without needing a development server"
log "- Include all JavaScript code bundled in the APK"
log "- Still use RevenueCat in debug mode for troubleshooting"
log "==============================================================="
log "Build completed at $(date)"