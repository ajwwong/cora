#!/bin/bash

# Script to build Android app using EAS Build
echo "Starting remote build process using EAS..."

# Build Android AAB using EAS Build with the production profile
npx eas-cli build --platform android --profile production --no-wait

echo "Build started. You can monitor the progress on the EAS dashboard."