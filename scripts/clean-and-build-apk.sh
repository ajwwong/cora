#!/bin/bash

# Script to clean and build a production APK with optimized memory settings
echo "Starting clean and build process for production APK..."

# First clean up any previous builds
echo "Cleaning previous builds..."
rm -rf ./android/app/build
rm -rf ./android/build

# Run prebuild to ensure native projects are updated
echo "Running prebuild..."
npx expo prebuild --clean

# Navigate to the android directory
cd ./android

# Clean and then build with optimized settings
echo "Cleaning Gradle project..."
./gradlew clean --max-workers=2

echo "Building release APK with optimized settings..."
./gradlew assembleRelease --max-workers=4 --no-daemon --stacktrace

if [ $? -eq 0 ]; then
  echo "Production build completed successfully. APK location:"
  echo "./android/app/build/outputs/apk/release/app-release.apk"
  
  # Copy the APK to the project root for easier access
  cp ./app/build/outputs/apk/release/app-release.apk ../feelheard-production.apk
  echo "APK copied to: ../feelheard-production.apk"
  
  # If adb is available, offer to install
  if command -v adb &> /dev/null; then
    echo ""
    echo "Would you like to install the APK on a connected device? (y/n)"
    read -r INSTALL_CHOICE
    
    if [ "$INSTALL_CHOICE" = "y" ] || [ "$INSTALL_CHOICE" = "Y" ]; then
      echo "Installing on device/emulator..."
      adb install -r ../feelheard-production.apk
      
      if [ $? -eq 0 ]; then
        echo "APK installed successfully!"
        echo "You can now launch the app from the device/emulator."
      else
        echo "APK installation failed. You may need to install it manually."
      fi
    else
      echo "Skipping installation. You can manually install the APK from: ../feelheard-production.apk"
    fi
  else
    echo "ADB not found. You'll need to install the APK manually."
  fi
else
  echo "Build failed. Check the output above for errors."
fi

echo ""
echo "==============================================================="
echo "NOTE: This is a production build. It will:"
echo "- Not connect to development servers"
echo "- Use real RevenueCat instead of simulation mode"
echo "- Process real subscriptions (use test accounts!)"
echo "==============================================================="