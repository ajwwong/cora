#!/bin/bash

# Script to generate a release keystore for Android app signing

# IMPORTANT WARNING
echo "⚠️ WARNING: This script is intended only for development or testing purposes."
echo "⚠️ For Play Store submissions, you MUST use the original keystore with SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
echo
echo "Once an app is published to the Play Store with a specific keystore,"
echo "all future updates MUST be signed with the same keystore."
echo
read -p "Are you sure you want to continue? This will NOT create a keystore compatible with Play Store uploads. (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 0
fi

# Create keystore directory if it doesn't exist
mkdir -p ../android/app/keystore

# Change to the android/app/keystore directory
cd ../android/app/keystore

# Define variables for keystore generation
KEYSTORE_FILE="release-key.keystore"
ALIAS="release-key-alias"
KEYSTORE_PASSWORD="feelheard"
KEY_PASSWORD="feelheard"
VALIDITY_YEARS=25

# Generate the keystore
keytool -genkeypair \
  -v \
  -keystore $KEYSTORE_FILE \
  -alias $ALIAS \
  -keyalg RSA \
  -keysize 2048 \
  -validity $(( VALIDITY_YEARS * 365 )) \
  -storepass $KEYSTORE_PASSWORD \
  -keypass $KEY_PASSWORD \
  -dname "CN=FeelHeard, OU=Mobile, O=FeelHeard, L=Unknown, ST=Unknown, C=US"

# Check if the keystore was created successfully
if [ -f "$KEYSTORE_FILE" ]; then
  echo "Keystore generated successfully at android/app/keystore/$KEYSTORE_FILE"
  echo "Please keep this file safe and secure. If you lose it, you won't be able to update your app!"
  echo
  echo "Keystore details:"
  echo "Path: android/app/keystore/$KEYSTORE_FILE"
  echo "Alias: $ALIAS"
  echo "Keystore password: $KEYSTORE_PASSWORD"
  echo "Key password: $KEY_PASSWORD"
  echo
  
  # Display fingerprint information
  echo "Keystore fingerprint:"
  keytool -list -v -keystore $KEYSTORE_FILE -storepass $KEYSTORE_PASSWORD | grep -A 1 "SHA1:"
  echo
  echo "⚠️ NOTE: This fingerprint does NOT match the one required by the Play Store: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
  echo
  
  echo "These values have been saved to android/keystore.properties"
  
  # Create a keystore.properties file to store these values
  cd ../../
  echo "storeFile=keystore/release-key.keystore" > keystore.properties
  echo "storePassword=$KEYSTORE_PASSWORD" >> keystore.properties
  echo "keyAlias=$ALIAS" >> keystore.properties
  echo "keyPassword=$KEY_PASSWORD" >> keystore.properties
  
  echo "Next steps:"
  echo "1. Build a release AAB with ./scripts/build-local-aab.sh"
  echo
  echo "⚠️ IMPORTANT: This keystore will NOT work for Play Store submissions."
  echo "For Play Store, you need to locate the original keystore with SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E"
else
  echo "Failed to generate keystore"
  exit 1
fi