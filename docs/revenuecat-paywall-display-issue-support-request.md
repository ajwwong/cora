# RevenueCat Paywall Display Issue - Support Request

## Issue Summary
The RevenueCat paywall UI is displaying incorrectly on iOS devices. The paywall header image is slipping off the edge of the screen, making the paywall appear unprofessional and potentially affecting conversion rates.

## Environment
- **Platform**: iOS
- **RevenueCat SDK Version**: 8.11.1 (recently updated from 8.10.1)
- **react-native-purchases**: 8.11.1
- **react-native-purchases-ui**: 8.11.1
- **React Native Version**: 0.79.2
- **Expo SDK**: 53.0.9
- **iOS Deployment Target**: 15.1
- **Affected Devices**: iOS simulators and physical devices

## Issue Description
When presenting the RevenueCat paywall using `RevenueCatUI.presentPaywall()` on iOS, we're experiencing two distinct issues:

### Issue 1: Paywall Not Appearing (RESOLVED)
**Status**: We've identified and fixed this issue in our code.
- **Problem**: Paywall failed to appear when triggered from VoiceMessageGate modal
- **Cause**: We were closing the parent modal before presenting the paywall, leaving iOS without a valid view controller
- **Solution**: Keep the parent modal open during paywall presentation (matching our SettingsModal implementation)

### Issue 2: Visual Display Problems (STILL OCCURRING)
When the paywall does appear, it displays with visual issues:

1. **Header Image Overflow**: The paywall header image extends beyond the screen boundaries, appearing to "slip off" the edge
2. **Width Issues**: The paywall appears to be rendered at an incorrect width, possibly related to iOS modal presentation styles
3. **Presentation Style**: The issue may be related to iOS 13+ default modal presentation style (`.pageSheet` vs `.fullScreen`)
4. **Platform Specific**: This only occurs on iOS - Android displays the paywall perfectly

## Expected Behavior
The paywall should display properly centered with:
- Header image fully contained within screen boundaries
- Proper margins and padding
- Professional appearance matching the paywall preview in RevenueCat dashboard

## Actual Behavior
- Header image extends beyond the visible screen area
- Content appears misaligned or improperly scaled
- The paywall looks unprofessional and may impact user experience

## Screenshots
[Placeholder for screenshots - to be added]
1. Expected appearance (what it should look like)
2. Actual appearance (showing the header image slipping off edge)

## Code Implementation

The paywall can be triggered from two different places in the app:

### 1. Voice Message Gate Modal
This modal appears when free users reach their daily voice message limit:

```tsx
// VoiceMessageGate.tsx - The modal that appears when limit is reached
export function VoiceMessageGate({
  isOpen,
  onClose,
  onAllowRecording,
  threadId,
  remainingMessages,
}: VoiceMessageGateProps) {
  // ... state and hooks ...

  return (
    <Modal isOpen={isOpen} onClose={closeModal} size="md">
      <ModalBackdrop onPress={closeModal} />
      <ModalContent className="m-4">
        <ModalHeader>
          <Heading size="md" className="text-center">
            Voice Message Limit Reached
          </Heading>
          <ModalCloseButton onPress={closeModal} />
        </ModalHeader>
        <ModalBody>
          <VStack space="md" className="items-center">
            <Icon as={Mic} size="xl" className="text-info-500" />
            <Text className="text-center">
              You've used all {FREE_DAILY_VOICE_MESSAGE_LIMIT} of your daily voice messages.
            </Text>
            <Text>Upgrade to Voice Connect for enhanced voice messaging.</Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onPress={closeModal} className="mr-2">
            <ButtonText>Continue with Text</ButtonText>
          </Button>
          <Button variant="solid" onPress={handleDirectUpgrade}>
            <ButtonText>Upgrade to Voice Connect</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
```

### Paywall Presentation Logic
```typescript
// The function that handles the upgrade button click
const handleDirectUpgrade = async () => {
  console.log("🛒 [VoiceGate] Upgrade button clicked - starting direct upgrade process");

  try {
    // Log upgrade attempt
    await logToAuditEvent("purchase", "VoiceGate Direct Upgrade Attempt", {
      currentUsage: voiceUsage,
      source: "voice_message_limit",
    });

    console.log("🛒 [VoiceGate] Closing modal first to avoid modal stacking issues");

    // Close the modal first to avoid modal stacking issues with RevenueCat paywall
    closeModal();

    // Small delay to ensure modal is fully closed before presenting paywall
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log("🛒 [VoiceGate] About to present RevenueCat paywall for upgrade");

    // Present RevenueCat native paywall directly
    // No custom options or styling are being passed
    const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

    console.log("🛒 [VoiceGate] Paywall result received:", paywallResult);

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
        await logToAuditEvent("purchase", "VoiceGate Upgrade Success", {
          result: "purchased",
          source: "voice_message_limit",
        });
        console.log("🛒 [VoiceGate] Purchase successful, allowing recording");
        // Allow the recording since they just upgraded (modal already closed)
        onAllowRecording();
        break;

      case PAYWALL_RESULT.RESTORED:
        await logToAuditEvent("purchase", "VoiceGate Upgrade Success", {
          result: "restored",
          source: "voice_message_limit",
        });
        console.log("🛒 [VoiceGate] Purchases restored, allowing recording");
        // Allow the recording since they restored premium (modal already closed)
        onAllowRecording();
        break;

      case PAYWALL_RESULT.CANCELLED:
        await logToAuditEvent("status_change", "VoiceGate Upgrade Cancelled", {
          result: "cancelled",
          source: "voice_message_limit",
        });
        console.log("🛒 [VoiceGate] User cancelled paywall, re-opening modal");
        // Re-open the modal since user cancelled (only if using internal state)
        if (!onClose) {
          setShowLimitModal(true);
        }
        break;

      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      default:
        await logToAuditEvent(
          "error",
          "VoiceGate Upgrade Error",
          {
            result: paywallResult,
            resultString: String(paywallResult),
            source: "voice_message_limit",
          },
          false,
        );
        console.log("🛒 [VoiceGate] Paywall not presented or error:", paywallResult);
        console.log("🛒 [VoiceGate] Falling back to subscription page");
        // Fallback to subscription page if paywall fails (modal already closed)
        router.push("/subscription");
        break;
    }
  } catch (error) {
    // Error handling...
  }
};
```

### 2. Settings Modal
The paywall can also be triggered from the Settings modal when free users click "Upgrade to Voice Connect":

```tsx
// SettingsModal.tsx - Settings modal with subscription status
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isPremium, customerInfo } = useSubscription();
  // ... other state ...

  // Direct paywall upgrade handler
  const handleDirectUpgrade = async () => {
    console.log("🛒 [SettingsModal] Upgrade button clicked - starting direct upgrade process");

    try {
      // Log upgrade attempt
      if (patientInfo?.id) {
        await logToSystemWithPatient("SettingsModal Direct Upgrade Attempt", patientInfo.id, {
          source: "settings_modal",
        });
      }

      console.log("🛒 [SettingsModal] About to present RevenueCat paywall for upgrade");

      // Present RevenueCat native paywall directly
      const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

      console.log("🛒 [SettingsModal] Paywall result received:", paywallResult);

      // ... handle paywall results ...
    } catch (error) {
      console.error("🛒 [SettingsModal] Paywall exception caught:", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* ... modal content ... */}
      
      {/* Subscription status section */}
      {isPremium ? (
        <Text className="text-sm text-typography-600">
          To manage your subscription, go to your device's App Store or Play Store settings.
        </Text>
      ) : (
        <View className="gap-3">
          <Text className="text-sm text-typography-600">
            Upgrade to Voice Connect for enhanced voice messaging.
          </Text>
          <Button variant="solid" onPress={handleDirectUpgrade}>
            <ButtonText>Upgrade to Voice Connect</ButtonText>
          </Button>
        </View>
      )}
      
      {/* ... rest of modal ... */}
    </Modal>
  );
}
```

### Key Implementation Details
1. **Two Entry Points**: Paywall can be triggered from either VoiceMessageGate modal or SettingsModal
2. **Modal Management**: Both modals now remain open when paywall is presented (we fixed VoiceMessageGate to match SettingsModal)
3. **No Custom Options**: Both implementations use the default `presentPaywall()` without any custom options
4. **Same Display Issue**: The header image overflow issue occurs from both entry points when paywall is visible
5. **iOS Specific**: The visual issues only occur on iOS; Android displays the paywall correctly

## Steps to Reproduce
1. Install the app on iOS device or simulator
2. Navigate to any screen with voice recording feature
3. As a free user, attempt to record after reaching the daily limit
4. Click "Upgrade to Voice Connect" button
5. Observe the paywall display with header image overflow

## What We've Tried
1. Updated RevenueCat SDK from 8.10.1 to 8.11.1
2. Cleaned and rebuilt the iOS project
3. Tested on multiple iOS devices and simulators
4. Fixed modal presentation issue (paywall now appears from both entry points)
5. Confirmed Android works perfectly with the same code
6. No custom styling or configuration is applied to the paywall

## Questions
1. Is this a known issue with the current SDK version?
2. Are there any configuration options to control the paywall presentation style or dimensions?
3. Can we force a specific modal presentation style (e.g., `.fullScreen`) for the paywall?
4. Are there any workarounds while waiting for a fix?

## Business Impact
This visual issue affects the professional appearance of our upgrade flow and may negatively impact conversion rates. Users may lose confidence in the app quality based on the paywall appearance.

## Additional Context
- The app uses Expo with custom native modules
- The issue occurs consistently across all iOS devices tested
- Android displays the paywall correctly without any issues
- We're using the standard RevenueCat paywall, not a custom implementation
- We discovered that the paywall requires a visible parent view controller on iOS (closing modals before presentation causes the paywall to not appear)
- Even with proper modal management, the visual display issues persist on iOS

## Contact Information
[Your contact details for follow-up]

---

**Request Type**: Bug Report
**Priority**: High (affects revenue generation)
**Category**: RevenueCatUI / Paywall Display