#!/bin/bash
# Windows ADB path - modify if needed
WADB="/mnt/c/Users/ajwwo/AppData/Local/Android/Sdk/platform-tools/adb.exe -s emulator-5554"

# Check if device is connected
echo "Checking emulator connection..."
$WADB devices

# Launch the app
echo "Launching app on emulator..."
$WADB shell monkey -p com.vinta.healthapp 1

echo "App should now be launched on your emulator"
echo "If you're seeing only the splash screen, check the logs with:"
echo "$WADB logcat *:E | grep 'Medplum\|progressnotes\|com.vinta.healthapp'"