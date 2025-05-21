#!/bin/bash

# Script to clean and build a debug APK with detailed RevenueCat logging
echo "Starting clean and build process for debug APK..."

# Create a log file with timestamp
LOG_FILE="../debug-build-log-$(date +%Y%m%d%H%M%S).log"
echo "Build log will be saved to: $LOG_FILE"

# Log function to write to both console and log file
log() {
  echo "$1" | tee -a "$LOG_FILE"
}

log "Debug build started at $(date)"
log "============================================="

# First clean up any previous builds
log "Cleaning previous builds..."
rm -rf ./android/app/build
rm -rf ./android/build

# Run prebuild to ensure native projects are updated
log "Running prebuild..."
npx expo prebuild --clean 2>&1 | tee -a "$LOG_FILE"

# Navigate to the android directory
cd ./android

# Clean and then build with optimized settings
log "Cleaning Gradle project..."
./gradlew clean --max-workers=2 2>&1 | tee -a "$LOG_FILE"

log "Building debug APK with RevenueCat debugging enabled..."
log "============================================="
# Add --info for more detailed logs, especially about RevenueCat integration
./gradlew assembleDebug --max-workers=4 --no-daemon --stacktrace --info -PrevenueCatDebug=true 2>&1 | tee -a "$LOG_FILE"
log "============================================="

if [ $? -eq 0 ]; then
  log "Debug build completed successfully. APK location:"
  log "./android/app/build/outputs/apk/debug/app-debug.apk"
  
  # Copy the APK to the project root for easier access
  cp ./app/build/outputs/apk/debug/app-debug.apk ../feelheard-debug.apk
  log "APK copied to: ../feelheard-debug.apk"
  log "Build log saved to: $LOG_FILE"
  
  # If adb is available, offer to install
  if command -v adb &> /dev/null; then
    log ""
    log "Would you like to install the APK on a connected device? (y/n)"
    read -r INSTALL_CHOICE
    
    if [ "$INSTALL_CHOICE" = "y" ] || [ "$INSTALL_CHOICE" = "Y" ]; then
      log "Installing on device/emulator..."
      adb install -r ../feelheard-debug.apk 2>&1 | tee -a "$LOG_FILE"
      
      if [ $? -eq 0 ]; then
        log "APK installed successfully!"
        log "You can now launch the app from the device/emulator."
      else
        log "APK installation failed. You may need to install it manually."
      fi
    else
      log "Skipping installation. You can manually install the APK from: ../feelheard-debug.apk"
    fi
  else
    log "ADB not found. You'll need to install the APK manually."
  fi
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
log "NOTE: This is a debug build. It will:"
log "- Be debuggable with Chrome DevTools"
log "- Include debug symbols for troubleshooting"
log "- Have enhanced RevenueCat logging enabled"
log "- May show RevenueCat debugging UI overlay"
log "==============================================================="
log "Build completed at $(date)"