# Android Development Guide for FeelHeard

This guide explains how to build, install and test the FeelHeard app on Android devices.

## Setup and Installation

### 1. Build Debug APK

```bash
# Navigate to the project directory
cd /root/mts/v1/cora

# Build the debug APK
cd android
./gradlew assembleDebug
```

The APK will be generated at:
```
/root/mts/v1/cora/android/app/build/outputs/apk/debug/app-debug.apk
```

### 2. Transfer APK to Device

You have several options:

**Option A: Direct ADB Install** (if device is connected via USB)
```bash
adb install /root/mts/v1/cora/android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B: File Transfer**
- Connect your device via USB and set USB mode to "File Transfer"
- Copy the APK to your device
- On your device, use a file manager to locate and install the APK
- Allow installation from unknown sources if prompted

**Option C: Cloud Transfer**
- Upload the APK to Google Drive or similar service
- Download the APK on your device
- Tap to install

### 3. Start Development Server

Once the app is installed on your device:

```bash
# Start development server with tunnel
cd /root/mts/v1/cora
npm run dev
```

This will start the Expo development server with a tunnel connection and display a QR code.

### 4. Connect App to Development Server

You have two options to connect:

**Option A: Direct Connection** (app already installed)
1. Open the FeelHeard app on your device
2. When prompted, enter the URL displayed in your terminal:
   ```
   exp+feelheard-me://expo-development-client/?url=https://xxxx-username-8082.exp.direct
   ```

**Option B: Using Expo Go** (for quicker testing)
1. Install "Expo Go" from Google Play Store
2. Open Expo Go
3. Scan the QR code displayed in your terminal
4. The app will load in Expo Go

**Important Limitations of Expo Go:**
- Native modules like RevenueCat may not work properly
- Custom native code is not supported
- Some device features may be unavailable
- Different performance characteristics than a real build

## Testing Subscriptions

The app uses RevenueCat for subscription management:

- In development mode, subscriptions are simulated
- Simulated data is displayed with "SIMULATED" badges
- You can test the purchase flow safely as no real charges will occur

### RevenueCat Status

To check RevenueCat initialization status:

1. Navigate to the subscription screen
2. Check console logs for RevenueCat initialization messages
3. Use the debug panel at the bottom of the subscription screen

## Troubleshooting

### Connection Issues

If you can't connect to the development server:

1. Ensure your device and computer are on the same network
2. Try using the tunnel URL (`https://xxxx-username-8082.exp.direct`)
3. Restart the Expo development server with:
   ```bash
   npm run dev
   ```

### RevenueCat Issues

If RevenueCat shows simulation mode consistently:

1. This is expected in development mode
2. Build a production release to test real purchases:
   ```bash
   cd /root/mts/v1/cora
   ./scripts/build-local-aab.sh
   ```

## Production Builds

### Option 1: Direct Production APK (Recommended)

The easiest way to build a production APK:

```bash
# Navigate to the project directory
cd /root/mts/v1/cora

# Build the production APK
npm run build:production-apk
```

This will:
- Build a production APK directly
- Copy the APK to `feelheard-production.apk` in the project root
- Offer to install it on a connected device

### Option 2: AAB Conversion Method

For building an AAB and converting to APK:

```bash
# Build an AAB (Android App Bundle)
cd /root/mts/v1/cora
./scripts/build-local-aab.sh

# Convert to universal APK
java -jar bundletool.jar build-apks --bundle=./android/app/build/outputs/bundle/release/app-release.aab --output=./universal.apks --mode=universal --ks=./android/app/debug.keystore --ks-pass=pass:android --ks-key-alias=androiddebugkey --key-pass=pass:android

# Extract universal APK
unzip -p universal.apks universal.apk > feelheard-universal.apk
```

### Installing and Using the Production APK

1. **Transfer the APK to your phone** (using adb, Google Drive, or USB transfer)
2. **Install the APK**:
   - Open the file manager on your phone
   - Navigate to where you saved the APK
   - Tap on the APK file
   - Allow installation from unknown sources if prompted
   - Tap "Install"

3. **Using the production app**:
   - The production APK will run independently without needing a development server
   - RevenueCat will run in real mode (not simulation)
   - To fully test RevenueCat in production mode:
     - Ensure you're logged in with a test account
     - Any purchases will attempt to process real transactions
     - Use test cards if available in your RevenueCat sandbox

**Benefits of testing with production APK:**
- Real-world behavior including actual RevenueCat initialization
- No simulation mode or development flags
- Exact same code that users will run
- No dependency on development server