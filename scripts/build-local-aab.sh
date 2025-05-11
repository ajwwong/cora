#!/bin/bash

# Create local AAB build script
echo "Starting local AAB build..."

# Navigate to the android directory
cd ./android

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

# Run gradle bundle task directly
./gradlew bundleRelease

echo "Build completed with version code $NEW_VERSION. Check the output in:"
echo "./android/app/build/outputs/bundle/release/app-release.aab"