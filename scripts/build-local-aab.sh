#!/bin/bash

# Create local AAB build script
echo "Starting local AAB build..."

# Navigate to the android directory
cd ./android

# Check if keystore.properties exists
if [ ! -f "keystore.properties" ]; then
    echo "WARNING: keystore.properties not found!"
    echo "You need the original release keystore with SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
    echo "Please copy keystore.properties.sample to keystore.properties and fill in the correct values."
    
    # Ask for confirmation to continue without the proper keystore
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Build aborted. Please set up the correct keystore first."
        exit 1
    fi
    
    echo "Continuing with debug keystore (this will likely fail on the Play Store)..."
fi

# Automatically increment the versionCode
BUILD_GRADLE_PATH="./app/build.gradle"
echo "Incrementing version code..."

# Get current version code
CURRENT_VERSION=$(grep -o "versionCode [0-9]*" $BUILD_GRADLE_PATH | awk '{print $2}')
NEW_VERSION=$((CURRENT_VERSION + 1))
echo "Current version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"

# Update the version code in build.gradle
sed -i "s/versionCode $CURRENT_VERSION/versionCode $NEW_VERSION/g" $BUILD_GRADLE_PATH
echo "Version code updated to $NEW_VERSION"

# Clean and build
./gradlew clean
# Run gradle bundle task directly
./gradlew bundleRelease --stacktrace

echo "Build completed with version code $NEW_VERSION. Check the output in:"
echo "./android/app/build/outputs/bundle/release/app-release.aab"

# Reminder about keystore
if [ ! -f "keystore.properties" ]; then
    echo
    echo "⚠️ REMINDER: This build was done WITHOUT the proper release keystore!"
    echo "The Google Play Store will reject this App Bundle because it's not signed with the correct key."
    echo "You need to obtain the original keystore with SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
fi