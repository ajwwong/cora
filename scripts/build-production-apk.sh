#!/bin/bash

# Script to build a production APK directly without going through AAB
echo "Starting production APK build..."

# First run prebuild to ensure native projects are updated
npx expo prebuild --clean

# Navigate to the android directory
cd ./android

# Run gradle release task directly with APK output
./gradlew assembleRelease

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