#!/bin/bash

# Create local debug APK build script
echo "Starting local debug build for RevenueCat testing..."

# First run prebuild to ensure native projects are updated
npx expo prebuild --clean

# Navigate to the android directory
cd ./android

# Run gradle debug task directly
./gradlew assembleDebug

if [ $? -eq 0 ]; then
  echo "Debug build completed successfully. APK location:"
  echo "./android/app/build/outputs/apk/debug/app-debug.apk"
  
  # If adb is available, offer to install
  if command -v adb &> /dev/null; then
    echo "Installing on device/emulator..."
    adb install -r ./app/build/outputs/apk/debug/app-debug.apk
    
    if [ $? -eq 0 ]; then
      echo "APK installed successfully!"
      echo "You can now launch the app from the device/emulator."
    else
      echo "APK installation failed. You may need to install it manually."
    fi
  else
    echo "ADB not found. You'll need to install the APK manually."
  fi
else
  echo "Build failed. Check the output above for errors."
fi