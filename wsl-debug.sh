#!/bin/bash
echo "Setting up for WSL/Windows emulator debugging..."

# Export variables explicitly
export EXPO_PUBLIC_MEDPLUM_WEB_CLIENT_ID="01965b46-a832-7301-a0ce-96efc842b6f4"
export EXPO_PUBLIC_MEDPLUM_NATIVE_CLIENT_ID="01965b47-c26d-73fb-a8bf-b5fb77c28816"

# Define wadb alias for convenience
alias wadb='/mnt/c/Users/ajwwo/AppData/Local/Android/Sdk/platform-tools/adb.exe -s emulator-5554'

# Build the Android APK
echo "Building Android app..."
cd android && ./gradlew assembleDebug && cd ..

# Get WSL IP address for Metro bundler
export WSL_IP=$(ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
echo "WSL IP address: $WSL_IP"

# Update the Metro bundler URL to use WSL IP
export REACT_NATIVE_PACKAGER_HOSTNAME=$WSL_IP

# Verify emulator connection
echo "Checking emulator connection..."
wadb devices

# Install the updated APK
echo "Installing APK on emulator..."
wadb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Start the Metro bundler
echo "Starting Metro bundler on $WSL_IP..."
DARK_MODE=media npx expo start --dev-client --clear