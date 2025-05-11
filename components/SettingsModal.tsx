import { router } from "expo-router";
import { CreditCard, Loader, Moon, Sun } from "lucide-react-native";
import { useCallback } from "react";

import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isAutoplayEnabled, isLoadingPreference, toggleAutoplay } = useUserPreferences();
  const { isPremium } = useSubscription();

  const handleToggleAutoplay = useCallback(() => {
    toggleAutoplay();
  }, [toggleAutoplay]);

  const navigateToSubscription = useCallback(() => {
    onClose(); // Close the modal first
    router.push("/subscription");
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Text className="text-typography-900" size="lg" bold>
            Settings
          </Text>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <View className="gap-6">
            <View className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center gap-2">
                <Icon
                  as={isAutoplayEnabled ? Sun : Moon}
                  size="sm"
                  className="text-typography-700"
                />
                <Text className="text-typography-900">Autoplay Audio Messages</Text>
              </View>
              {isLoadingPreference ? (
                <View className="h-6 w-10 items-center justify-center">
                  <Icon as={Loader} size="sm" className="text-primary-500" />
                </View>
              ) : (
                <Switch value={isAutoplayEnabled} onValueChange={handleToggleAutoplay} />
              )}
            </View>

            <Text className="text-sm text-typography-600">
              When enabled, audio messages will automatically play when received within the last 2
              minutes. This preference is saved to your account and will persist across all your
              devices.
            </Text>

            <Divider my={4} />

            {/* Subscription Management */}
            <View className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center gap-2">
                <Icon as={CreditCard} size="sm" className="text-typography-700" />
                <Text className="text-typography-900">Subscription</Text>
              </View>
              <View>
                <Text className="text-typography-600">
                  {isPremium ? "Voice Connect" : "Text Companion"}
                </Text>
              </View>
            </View>

            <Button variant="outline" onPress={navigateToSubscription} size="sm" className="mb-4">
              <ButtonIcon as={CreditCard} size="sm" />
              <ButtonText>
                {isPremium ? "Manage Subscription" : "Upgrade to Voice Connect"}
              </ButtonText>
            </Button>

            <View className="items-center pt-4">
              <Button onPress={onClose} action="primary" variant="solid">
                <ButtonText>Done</ButtonText>
              </Button>
            </View>
          </View>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
