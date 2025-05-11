#!/bin/bash

# Copy the actual file to a temporary location
cp /root/mts/v1/cora/android/app/google-services.json /tmp/google-services.json

# Create environment variable using the file and specify production environment
eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value /tmp/google-services.json --environment production

# Clean up
rm /tmp/google-services.json

echo "Secret GOOGLE_SERVICES_JSON has been created."