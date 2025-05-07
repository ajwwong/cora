# FeelHeard App Development Guide

## Building and Running the App

### Prerequisites
- Android Studio with Emulator set up
- WSL2 with development environment
- Expo CLI installed: `npm install -g expo-cli`
- EAS CLI installed: `npm install -g eas-cli`

### Setup Development Environment

1. **Build the app for development**

```bash
# Clean and rebuild the development client
cd /root/mts/v1/cora
npx expo prebuild --clean

# Build for Android device/emulator
npx expo run:android --device

# Alternatively, build just the APK
cd android
./gradlew assembleDebug
```

2. **Set up ADB connection to emulator**

```bash
# Set up the Windows ADB alias
cd /root/mts/v1/cora
alias wadb='/mnt/c/Users/ajwwo/AppData/Local/Android/Sdk/platform-tools/adb.exe -s emulator-5554'

# Install the APK on emulator (if built with gradlew)
wadb install android/app/build/outputs/apk/debug/app-debug.apk
```

3. **Start Expo development server**

```bash
# Start the development server
cd /root/mts/v1/cora
npx expo start --dev-client
```

4. **Connect app to development server**

```bash
# Launch the app on emulator
wadb shell monkey -p me.feelheard 1

# Get your WSL IP address
export WSL_IP=$(ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

# Connect directly to your development server
wadb shell am start -a android.intent.action.VIEW -d "exp+feelheard://expo-development-client/?url=http%3A%2F%2F$WSL_IP%3A8081"
```

If the direct intent doesn't work:
1. In the emulator, press Ctrl+M to open the dev menu
2. Select "Connect to development server"
3. Enter your WSL IP with port: http://YOUR_WSL_IP:8081

## Building for Production

### Build an APK for testing

```bash
# Build a local APK for testing
cd /root/mts/v1/cora
npx eas-cli build --platform android --profile local-apk --non-interactive
```

### Build for Google Play Store

```bash
# Build an AAB for Google Play submission
cd /root/mts/v1/cora
npx eas-cli build --platform android --profile production --non-interactive
```

### Check build status

```bash
# List recent builds
npx eas-cli build:list --limit 1

# Download a completed build
npx eas-cli build:download --build-id YOUR_BUILD_ID
```

## Configuration Notes

- App scheme is set to "feelheard" in both app.json and app.config.ts
- Package name is "me.feelheard"
- Firebase configuration is in android/app/google-services.json

## Troubleshooting

If you encounter issues with the development client connection:
1. Check your WSL IP address is correct
2. Verify the app scheme is "feelheard" in both app.json and app.config.ts
3. Make sure the app is properly installed on the emulator
4. Try rebuilding the development client with `npx expo prebuild --clean`