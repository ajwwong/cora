import {
  AlertCircleIcon,
  BoltIcon,
  LockIcon,
  MessageSquareIcon,
  MicIcon,
  ZapIcon,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView } from "react-native";

import { FREE_DAILY_VOICE_MESSAGE_LIMIT } from "../utils/subscription/config";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./Modal";
import { Button, ButtonText } from "./ui/button";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface WelcomeWalkthroughProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Multi-step welcome walkthrough for first-time users of the Reflection Guide app
 */
export function WelcomeWalkthrough({ opened, onClose }: WelcomeWalkthroughProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      // Reset step for next time
      setStep(0);
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <ScrollView className="max-h-[400px]">
            <View className="mb-6">
              <Text className="mb-2 text-base font-medium">
                The Reflection Guide is an AI-powered tool to help you explore your thoughts and
                feelings between therapy sessions. It provides a safe space for reflection and
                personal growth.
              </Text>

              <Text className="mb-4 text-sm">
                You can start new conversations anytime, exploring different topics or themes. Your
                therapist may also review these reflections to better understand your progress.
              </Text>

              <View className="mt-4">
                <View className="mb-2 flex-row items-center">
                  <MessageSquareIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">Type messages or record audio</Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <LockIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">Private and secure conversations</Text>
                </View>
                <View className="flex-row items-center">
                  <AlertCircleIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">Supportive AI guidance for reflection</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        );

      case 1:
        return (
          <ScrollView className="max-h-[400px]">
            <View className="mb-6">
              <Text className="mb-2 text-base font-medium">
                You can type messages directly to the Reflection Guide. This works well for:
              </Text>

              <View className="mb-4 mt-2">
                <Text className="mb-1 text-sm">• Detailed, thoughtful reflections</Text>
                <Text className="mb-1 text-sm">• When you prefer writing over speaking</Text>
                <Text className="text-sm">• Quiet environments where speaking isn't ideal</Text>
              </View>

              <Text className="mb-4 text-sm">
                The guide will respond thoughtfully to your messages, asking questions to help you
                explore your thoughts more deeply.
              </Text>

              <Text className="mb-2 text-base font-medium">Try starting with prompts like:</Text>

              <View>
                <Text className="mb-1 text-sm">• "I've been feeling anxious about..."</Text>
                <Text className="mb-1 text-sm">• "I'm trying to understand why I..."</Text>
                <Text className="text-sm">• "I'm not sure how to handle..."</Text>
              </View>
            </View>
          </ScrollView>
        );

      case 2:
        return (
          <ScrollView className="max-h-[400px]">
            <View className="mb-6">
              <Text className="mb-2 text-base font-medium">
                You can also record audio messages by tapping the microphone icon. This is great
                for:
              </Text>

              <View className="mb-4 mt-2">
                <View className="mb-2 flex-row items-center">
                  <MicIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">
                    Expressing emotions that are hard to put into words
                  </Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <MicIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">When you prefer speaking over typing</Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <MicIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">Capturing thoughts quickly on the go</Text>
                </View>
              </View>

              <Text className="mb-3 text-sm">
                Your audio will be transcribed automatically, and the guide will respond with both
                text and an audio reply you can listen to.
              </Text>

              <Text className="text-xs text-gray-500">
                Note: You'll need to grant microphone permissions when using this feature for the
                first time.
              </Text>
            </View>
          </ScrollView>
        );

      case 3:
        return (
          <ScrollView className="max-h-[400px]">
            <View className="mb-6">
              <Text className="mb-2 text-base font-medium">
                Cora offers a freemium model with two plans:
              </Text>

              <View className="mb-4 rounded-lg bg-gray-100 p-3">
                <Text className="mb-1 font-medium">Free Plan</Text>
                <View className="mb-2 flex-row items-center">
                  <MessageSquareIcon size={16} color="#4B5563" />
                  <Text className="ml-2 text-sm">Unlimited text conversations</Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <MicIcon size={16} color="#4B5563" />
                  <Text className="ml-2 text-sm">
                    {FREE_DAILY_VOICE_MESSAGE_LIMIT} voice messages per day
                  </Text>
                </View>
              </View>

              <View className="mb-4 rounded-lg bg-primary-50 p-3">
                <Text className="mb-1 font-medium text-primary-700">
                  Voice Connect Subscription
                </Text>
                <View className="mb-2 flex-row items-center">
                  <ZapIcon size={16} color="#4B5563" />
                  <Text className="ml-2 text-sm">Unlimited voice messaging</Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <BoltIcon size={16} color="#4B5563" />
                  <Text className="ml-2 text-sm">Enhanced voice features (coming soon)</Text>
                </View>
              </View>

              <Text className="text-sm">
                You can upgrade to Voice Connect anytime through the settings menu if you find
                yourself using voice messaging frequently.
              </Text>
            </View>
          </ScrollView>
        );

      case 4:
        return (
          <ScrollView className="max-h-[400px]">
            <View className="mb-6">
              <Text className="mb-2 text-base font-medium">
                Your privacy and security are important to us. Here's what you should know:
              </Text>

              <View className="mb-4 mt-2">
                <View className="mb-2 flex-row items-center">
                  <LockIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">Your conversations are private and encrypted</Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <LockIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">
                    Your therapist may review these reflections as part of your care
                  </Text>
                </View>
                <View className="mb-2 flex-row items-center">
                  <LockIcon size={18} color="#4B5563" />
                  <Text className="ml-2 text-sm">
                    The AI does not store or use your data for training
                  </Text>
                </View>
              </View>

              <Text className="mb-2 text-base font-medium">Important reminders:</Text>

              <View>
                <Text className="mb-2 text-sm">
                  • The Reflection Guide is not a crisis service. For emergencies, please contact
                  your therapist or emergency services.
                </Text>
                <Text className="text-sm">
                  • This tool is not a replacement for professional therapy.
                </Text>
              </View>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  // Step indicator dots
  const renderDots = () => {
    return (
      <View className="mb-2 mt-4 flex-row justify-center">
        {[0, 1, 2, 3, 4].map((index) => (
          <View
            key={index}
            className={`mx-1 h-2 w-2 rounded-full ${step === index ? "bg-primary-500" : "bg-gray-300"}`}
          />
        ))}
      </View>
    );
  };

  const titles = [
    "Welcome to Cora",
    "Text Chat",
    "Voice Recording",
    "Subscription Plans",
    "Privacy & Important Info",
  ];

  return (
    <Modal isOpen={opened} onClose={onClose}>
      <ModalHeader>{titles[step]}</ModalHeader>
      <ModalBody>
        {renderStep()}
        {renderDots()}
      </ModalBody>
      <ModalFooter>
        <View className="w-full flex-row justify-between">
          <Button variant="outline" onPress={handleBack} disabled={step === 0}>
            <ButtonText>Back</ButtonText>
          </Button>
          <Button onPress={handleNext}>
            <ButtonText>{step === 4 ? "Get Started" : "Next"}</ButtonText>
          </Button>
        </View>
      </ModalFooter>
    </Modal>
  );
}
