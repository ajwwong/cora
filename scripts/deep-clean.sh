#!/bin/bash

# Script to perform a deep clean of the React Native project
echo "Starting deep clean of the project..."

# Clear React Native caches
echo "Clearing React Native caches..."
rm -rf $TMPDIR/react-* || true
rm -rf $TMPDIR/metro-* || true
rm -rf $TMPDIR/haste-* || true

# Clear watchman watches
echo "Clearing watchman watches..."
watchman watch-del-all || echo "Watchman not installed or not running"

# Clear npm/yarn caches
echo "Clearing npm cache for this project..."
npm cache clean --force

# Clear Android build files
echo "Clearing Android build files..."
rm -rf ./android/app/build
rm -rf ./android/build
rm -rf ./android/.gradle

# Clear iOS build files (if they exist)
if [ -d "./ios/build" ]; then
  echo "Clearing iOS build files..."
  rm -rf ./ios/build
  rm -rf ./ios/Pods
fi

# Clear node_modules and reinstall
echo "Would you like to remove node_modules and reinstall? (y/n)"
read -r REINSTALL_CHOICE

if [ "$REINSTALL_CHOICE" = "y" ] || [ "$REINSTALL_CHOICE" = "Y" ]; then
  echo "Removing node_modules..."
  rm -rf ./node_modules
  
  echo "Reinstalling dependencies..."
  npm install
fi

echo "Deep clean completed!"
echo "For a complete rebuild, run: npx expo prebuild --clean"