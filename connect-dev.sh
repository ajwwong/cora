#!/bin/bash
# Full path to ADB
ADB="/mnt/c/Users/ajwwo/AppData/Local/Android/Sdk/platform-tools/adb.exe"
DEVICE="emulator-5554"

# Get WSL IP address
WSL_IP=$(ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
echo "WSL IP: $WSL_IP"

# Check if device is connected
echo "Checking emulator connection..."
$ADB -s $DEVICE devices

# Make sure the app is closed first
echo "Closing app if running..."
$ADB -s $DEVICE shell am force-stop me.feelheard

# Launch the app
echo "Launching app..."
$ADB -s $DEVICE shell monkey -p me.feelheard 1
sleep 2

# Try connecting with the original URI scheme
echo "Connecting to development server..."
$ADB -s $DEVICE shell am start -a android.intent.action.VIEW -d "exp+feelheard://expo-development-client/?url=http%3A%2F%2F$WSL_IP%3A8081"

# If that fails, try alternative URI schemes
if [ $? -ne 0 ]; then
  echo "First attempt failed, trying alternative URI scheme..."
  $ADB -s $DEVICE shell am start -a android.intent.action.VIEW -d "feelheard://expo-development-client/?url=http%3A%2F%2F$WSL_IP%3A8081"
fi

echo "Connection attempt complete. Check your device to see if it worked."
echo "If not successful, try manually opening dev menu with Ctrl+M and enter: http://$WSL_IP:8081"