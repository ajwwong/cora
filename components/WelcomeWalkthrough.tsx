import { ScrollView } from "react-native";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { Button, ButtonText } from "./ui/button";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface WelcomeWalkthroughProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Welcome walkthrough for first-time users of the Reflection Guide
 */
export function WelcomeWalkthrough({ opened, onClose }: WelcomeWalkthroughProps) {
  return (
    <Modal isOpen={opened} onClose={onClose}>
      <ModalHeader>Welcome to Your Reflection Guide</ModalHeader>
      <ModalBody>
        <ScrollView className="max-h-[400px]">
          <View className="mb-6">
            <Text className="text-lg font-bold mb-2">What is the Reflection Guide?</Text>
            <Text className="text-sm">
              The Reflection Guide is an AI-powered tool to help you explore your thoughts
              and feelings between therapy sessions. It's a safe space for personal reflection.
            </Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-lg font-bold mb-2">How it works:</Text>
            <Text className="text-sm mb-1">1. Start a new reflection session</Text>
            <Text className="text-sm mb-1">2. Type or speak your thoughts</Text>
            <Text className="text-sm mb-1">3. Receive supportive, reflective responses</Text>
            <Text className="text-sm">4. Continue the conversation at your own pace</Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-lg font-bold mb-2">Important to remember:</Text>
            <Text className="text-sm">
              This is not a replacement for your therapy sessions, but a tool to support
              your journey. Your conversations are private, but may be reviewed by your
              provider to better understand your progress.
            </Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-lg font-bold mb-2">Benefits of reflection:</Text>
            <Text className="text-sm mb-1">• Develop deeper self-awareness</Text>
            <Text className="text-sm mb-1">• Process thoughts and feelings between sessions</Text>
            <Text className="text-sm mb-1">• Track your progress over time</Text>
            <Text className="text-sm">• Build healthy reflection habits</Text>
          </View>
        </ScrollView>
      </ModalBody>
      <ModalFooter>
        <Button onPress={onClose} className="min-w-[150px]">
          <ButtonText>Get Started</ButtonText>
        </Button>
      </ModalFooter>
    </Modal>
  );
}