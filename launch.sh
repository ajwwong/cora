#!/bin/bash
  WSL_IP=$(ip addr show eth0 | grep -oP "(?<=inet\s)\d+(\.\d+){3}")
  ADB="/mnt/c/Users/ajwwo/AppData/Local/Android/Sdk/platform-tools/adb.exe"
  $ADB -s emulator-5554 shell monkey -p me.feelheard 1
  sleep 2
  $ADB -s emulator-5554 shell am start -a android.intent.action.VIEW -d "feelheard://expo-development-client/?url=http%3A%2F%2F$WSL_IP%3A8081"
  
