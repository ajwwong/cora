#!/bin/bash

# Create local AAB build script
echo "Starting local AAB build..."

# Create a log file with timestamp
LOG_FILE="../build-log-$(date +%Y%m%d%H%M%S).log"
echo "Build log will be saved to: $LOG_FILE"

# Log function to write to both console and log file
log() {
  echo "$1" | tee -a "$LOG_FILE"
}

log "AAB build started at $(date)"
log "============================================="

# Navigate to the android directory
cd ./android

# Check if keystore.properties exists
if [ ! -f "keystore.properties" ]; then
    log "WARNING: keystore.properties not found!"
    log "You need the original release keystore with SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
    log "Please copy keystore.properties.sample to keystore.properties and fill in the correct values."
    
    # Ask for confirmation to continue without the proper keystore
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Build aborted. Please set up the correct keystore first."
        exit 1
    fi
    
    log "Continuing with debug keystore (this will likely fail on the Play Store)..."
fi

# Automatically increment the versionCode
BUILD_GRADLE_PATH="./app/build.gradle"
log "Incrementing version code..."

# Get current version code
CURRENT_VERSION=$(grep -o "versionCode [0-9]*" $BUILD_GRADLE_PATH | awk '{print $2}')

# Check if version is 1 and prompt for desired version
if [ "$CURRENT_VERSION" -eq 1 ]; then
    log "Current version code is 1. What version number should be updated to?"
    read -p "Enter the desired version code (or press Enter to increment to 2): " DESIRED_VERSION
    
    # If no input provided, default to incrementing
    if [ -z "$DESIRED_VERSION" ]; then
        NEW_VERSION=2
    else
        # Validate that input is a number and greater than current version
        if [[ "$DESIRED_VERSION" =~ ^[0-9]+$ ]] && [ "$DESIRED_VERSION" -gt "$CURRENT_VERSION" ]; then
            NEW_VERSION=$DESIRED_VERSION
        else
            log "Invalid version number. Must be a positive integer greater than $CURRENT_VERSION. Using incremented version instead."
            NEW_VERSION=$((CURRENT_VERSION + 1))
        fi
    fi
else
    NEW_VERSION=$((CURRENT_VERSION + 1))
fi

log "Current version: $CURRENT_VERSION"
log "New version: $NEW_VERSION"

# Update the version code in build.gradle
sed -i "s/versionCode $CURRENT_VERSION/versionCode $NEW_VERSION/g" $BUILD_GRADLE_PATH
log "Version code updated to $NEW_VERSION"

# Clean and build
log "Cleaning Gradle project..."
./gradlew clean 2>&1 | tee -a "$LOG_FILE"

log "Building AAB bundle..."
log "============================================="
# Run gradle bundle task directly
./gradlew bundleRelease --stacktrace 2>&1 | tee -a "$LOG_FILE"
log "============================================="

if [ $? -eq 0 ]; then
  log "AAB build completed successfully with version code $NEW_VERSION"
  log "Output location: ./android/app/build/outputs/bundle/release/app-release.aab"
  
  # Copy the AAB to the project root for easier access
  cp ./app/build/outputs/bundle/release/app-release.aab ../feelheard-production.aab
  log "AAB copied to: ../feelheard-production.aab"
  log "Build log saved to: $LOG_FILE"
else
  log "AAB build failed. Check the log file for errors: $LOG_FILE"
  # Extract key error messages for quick review
  log "=================== KEY ERROR MESSAGES ======================"
  grep -E "error:|exception:|failure" "$LOG_FILE" | tail -n 20 | tee -a "$LOG_FILE.errors"
  log "============================================================"
  log "Detailed error summary saved to: $LOG_FILE.errors"
fi

log "AAB build completed at $(date)"

# Reminder about keystore
if [ ! -f "keystore.properties" ]; then
    log ""
    log "⚠️ REMINDER: This build was done WITHOUT the proper release keystore!"
    log "The Google Play Store will reject this App Bundle because it's not signed with the correct key."
    log "You need to obtain the original keystore with SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
fi