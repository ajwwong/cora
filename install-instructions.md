# Installing FeelHeard APK

Since direct ADB installation from WSL might be challenging, follow these steps:

## Option 1: Copy APKs to Windows and use ADB from Windows

1. Copy all APKs from WSL to your Windows system:
   - Navigate to: `\\wsl$\Ubuntu\root\mts\v1\cora\extracted_apks\`
   - Copy the APK files to a location on your Windows drive

2. Install using ADB from Windows Command Prompt:
   ```
   adb install base-arm64_v8a.apk
   ```

## Option 2: Install directly on device

1. Copy the APK to your Pixel:
   - Connect your Pixel and set USB mode to "File Transfer"
   - Navigate to: `\\wsl$\Ubuntu\root\mts\v1\cora\extracted_apks\`
   - Copy `base-arm64_v8a.apk` to your phone's Download folder

2. Install from your Pixel:
   - Open Files app on your Pixel
   - Navigate to the Download folder
   - Tap on the APK to install
   - Allow installation from unknown sources if prompted

## Option 3: Create Universal APK

If the above options don't work, we can create a universal APK:

```bash
cd /root/mts/v1/cora
java -jar bundletool.jar build-apks --bundle=./android/app/build/outputs/bundle/release/app-release.aab --output=./universal.apks --mode=universal --ks=./android/app/debug.keystore --ks-pass=pass:android --ks-key-alias=androiddebugkey --key-pass=pass:android
unzip -p universal.apks universal.apk > feelheard-universal.apk
```

Then install feelheard-universal.apk using any of the methods above.