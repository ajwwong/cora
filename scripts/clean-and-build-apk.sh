#!/bin/bash

# Script to clean and build a production APK with optimized memory settings
echo "Starting clean and build process for production APK..."

# Create a log file with timestamp
LOG_FILE="../build-log-$(date +%Y%m%d%H%M%S).log"
echo "Build log will be saved to: $LOG_FILE"

# Log function to write to both console and log file
log() {
  echo "$1" | tee -a "$LOG_FILE"
}

log "Build started at $(date)"
log "============================================="

# First clean up any previous builds
log "Cleaning previous builds..."
rm -rf ./android/app/build
rm -rf ./android/build

# Run prebuild to ensure native projects are updated
log "Running prebuild..."
npx expo prebuild 2>&1 | tee -a "$LOG_FILE"

# Navigate to the android directory
cd ./android

# Clean and then build with optimized settings
log "Cleaning Gradle project..."
./gradlew clean --max-workers=2 2>&1 | tee -a "$LOG_FILE"

log "Building release APK with optimized settings and RevenueCat debugging..."
log "============================================="
# Add --info for more detailed logs
./gradlew assembleRelease --max-workers=4 --no-daemon --stacktrace --info -PrevenueCatDebug=true 2>&1 | tee -a "$LOG_FILE"
log "============================================="

if [ $? -eq 0 ]; then
  log "Production build completed successfully. APK location:"
  log "./android/app/build/outputs/apk/release/app-release.apk"
  
  # Copy the APK to the project root for easier access
  cp ./app/build/outputs/apk/release/app-release.apk ../feelheard-production.apk
  log "APK copied to: ../feelheard-production.apk"
  log "Build log saved to: $LOG_FILE"
  
  # If adb is available, offer to install
  if command -v adb &> /dev/null; then
    log ""
    log "Would you like to install the APK on a connected device? (y/n)"
    read -r INSTALL_CHOICE
    
    if [ "$INSTALL_CHOICE" = "y" ] || [ "$INSTALL_CHOICE" = "Y" ]; then
      log "Installing on device/emulator..."
      adb install -r ../feelheard-production.apk 2>&1 | tee -a "$LOG_FILE"
      
      if [ $? -eq 0 ]; then
        log "APK installed successfully!"
        log "You can now launch the app from the device/emulator."
      else
        log "APK installation failed. You may need to install it manually."
      fi
    else
      log "Skipping installation. You can manually install the APK from: ../feelheard-production.apk"
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
log "NOTE: This is a production build. It will:"
log "- Not connect to development servers"
log "- Use real RevenueCat instead of simulation mode"
log "- Process real subscriptions (use test accounts!)"
log "==============================================================="
log "Build completed at $(date)"