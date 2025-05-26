# ADB Wireless Debugging Guide

## Setup Wireless ADB Connection

### Method 1: USB-to-Wireless (Traditional)

#### 1. Enable Wireless Connection
First connect your Android device via USB cable, then run:
```bash
adb tcpip 5555
```

#### 2. Find Device IP Address
On your Android device:
- Go to **Settings** > **About Phone** > **Status** > **IP Address**
- Note down the IP address (e.g., 192.168.1.100)

#### 3. Connect Wirelessly
Disconnect the USB cable and run:
```bash
adb connect <device-ip>:5555
```

Example:
```bash
adb connect 192.168.1.100:5555
```

#### 4. Verify Connection
Check that your device is connected wirelessly:
```bash
adb devices
```

You should see your device listed with the IP address.

### Method 2: Wireless Debugging with Pairing Code (Android 11+)

#### 1. Enable Wireless Debugging
On your Android device:
- Go to **Settings** > **Developer Options** > **Wireless Debugging**
- Turn on **Wireless Debugging**
- Tap **Pair device with pairing code**

#### 2. Note the Pairing Information
The device will show:
- **IP address and port** (e.g., `10.0.0.133:41555`)
- **Wi-Fi pairing code** (6-digit code)

#### 3. Pair Using ADB
On your computer, run:
```bash
adb pair <ip>:<port>
```

Example for Pixel 6:
```bash
adb pair 10.0.0.133:41555
```

When prompted, enter the 6-digit pairing code shown on your device.

#### 4. Connect to Device
After successful pairing, the device will show a different port for connection (usually 5555).
Connect using:
```bash
adb connect <ip>:5555
```

Example:
```bash
adb connect 10.0.0.133:5555
```

#### 5. Verify Connection
Check that your device is connected:
```bash
adb devices
```

**Note:** Method 2 is more secure and doesn't require USB connection, but requires Android 11 or later.

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

### Filtered Error Logs (Windows)
To view only critical errors and app-specific logs on Windows:
```bash
adb logcat | findstr "FATAL AndroidRuntime ReactNativeJS feelheard revenuecat"
```

### Filtered Error Logs (Linux/Mac)
To view only critical errors and app-specific logs on Linux/Mac:
```bash
adb logcat | grep -E "(FATAL|AndroidRuntime|ReactNativeJS|feelheard|revenuecat)"
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