# ADB Wireless Debugging Guide

## Setup Wireless ADB Connection

### 1. Enable Wireless Connection
First connect your Android device via USB cable, then run:
```bash
adb tcpip 5555
```

### 2. Find Device IP Address
On your Android device:
- Go to **Settings** > **About Phone** > **Status** > **IP Address**
- Note down the IP address (e.g., 192.168.1.100)

### 3. Connect Wirelessly
Disconnect the USB cable and run:
```bash
adb connect <device-ip>:5555
```

Example:
```bash
adb connect 192.168.1.100:5555
```

### 4. Verify Connection
Check that your device is connected wirelessly:
```bash
adb devices
```

You should see your device listed with the IP address.

## Viewing Console Logs

### React Native JavaScript Logs
To view console.log statements from your React Native app:
```bash
adb logcat -s ReactNativeJS
```

### App-Specific Logs
To view all logs related to your app:
```bash
adb logcat | grep -i "feelheard"
```

### All System Logs
To view all Android system logs:
```bash
adb logcat
```

## Troubleshooting

### Connection Issues
- Ensure both computer and device are on the same WiFi network
- If connection fails, try restarting ADB: `adb kill-server` then `adb start-server`
- Re-enable wireless mode: `adb tcpip 5555`

### Reconnecting
If the wireless connection is lost:
1. Reconnect via USB
2. Run `adb tcpip 5555` again
3. Disconnect USB and use `adb connect <ip>:5555`