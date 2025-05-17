# Android App Signing Guide

## Issue: Play Store Keystore Mismatch

The app is currently configured to use a debug keystore for release builds, which is causing rejection from the Google Play Store with the error message:

```
Your Android App Bundle is signed with the wrong key. Ensure that your App Bundle is signed with the correct signing key and try again. Your App Bundle is expected to be signed with the certificate with fingerprint:
SHA1: C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E
but the certificate used to sign the App Bundle you uploaded has fingerprint:
SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

## Required Action

To fix this issue, you need to locate and use the original keystore that was used to publish the app to the Play Store initially. This keystore should have the SHA1 fingerprint:

```
C6:AE:38:98:0D:43:8F:AB:C4:A8:F8:7E:9E:AE:97:29:18:58:89:1E
```

## How to Configure Signing

After locating the correct keystore:

1. Place the keystore file in the directory: `/root/mts/v1/cora/android/app/keystore/`
2. Create a file called `keystore.properties` in the `/root/mts/v1/cora/android/` directory with the following content (replacing with your actual values):

```properties
storeFile=keystore/your-keystore-file-name.keystore
storePassword=your-keystore-password
keyAlias=your-key-alias
keyPassword=your-key-password
```

3. Build your release AAB with:
```bash
./scripts/build-local-aab.sh
```

## Important Notes

- **Never lose your keystore file** - If you lose the keystore, you will be unable to publish updates to your existing app on the Play Store
- **Keep your keystore secure** - Do not commit it to version control
- **Back up your keystore** - Make multiple secure copies in different locations
- **Document your keystore details** - Store passwords and key alias information securely

## What If I Can't Find the Original Keystore?

If you cannot locate the original keystore, your options are:

1. **Contact the original developer** or whoever first published the app to the Play Store
2. **Check secure storage locations** where the keystore might have been backed up
3. **As a last resort**: If the keystore is truly lost, you'll need to publish under a new package name, effectively creating a new app on the Play Store and migrating users

## Technical Information

The application has been updated with proper configurations to use the release keystore when it's available. The following changes were made:

1. Added a release signing configuration in `android/app/build.gradle`
2. Updated build scripts to check for and use the keystore properties
3. Added warning messages when building without the proper keystore
4. Created a sample keystore properties file (`android/keystore.properties.sample`) for reference

## Future Best Practices

- Always use App Signing by Google Play to protect against keystore loss
- Document your signing information securely
- For new apps, set up CI/CD to securely manage signing keys