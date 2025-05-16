#!/bin/bash

# Script to generate a release keystore for Android app signing

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
  echo "These values have been saved to android/keystore.properties"
  
  # Create a keystore.properties file to store these values
  cd ../../
  echo "storeFile=keystore/release-key.keystore" > keystore.properties
  echo "storePassword=$KEYSTORE_PASSWORD" >> keystore.properties
  echo "keyAlias=$ALIAS" >> keystore.properties
  echo "keyPassword=$KEY_PASSWORD" >> keystore.properties
  
  echo "Next steps:"
  echo "1. Update build.gradle to use this keystore for release builds"
  echo "2. Build a release AAB with ./scripts/build-local-aab.sh"
else
  echo "Failed to generate keystore"
  exit 1
fi