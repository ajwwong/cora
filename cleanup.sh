#!/bin/bash
echo "Cleaning up Expo project..."

# Clear metro bundler cache
rm -rf $HOME/.expo
rm -rf node_modules/.cache

# Clear watchman watches if it exists
if command -v watchman &> /dev/null; then
  watchman watch-del-all
fi

# Remove build artifacts
rm -rf android/app/build
rm -rf ios/build

# Clear expo cache
npx expo-cli start --clear

echo "Cleanup complete! Now run: npm start -- --reset-cache"