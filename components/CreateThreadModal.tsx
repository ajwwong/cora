import { useRouter } from "expo-router";
import { useState } from "react";

import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Radio, RadioGroup, RadioIndicator, RadioIcon, RadioLabel } from "@/components/ui/radio";
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronDownIcon } from "lucide-react-native";

interface CreateThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateThread: (topic: string, options?: { 
    isReflectionThread?: boolean; 
    reflectionTheme?: string;
  }) => Promise<string | undefined>;
}

export function CreateThreadModal({ isOpen, onClose, onCreateThread }: CreateThreadModalProps) {
  const [topic, setTopic] = useState("");
  const [isReflectionThread, setIsReflectionThread] = useState(false);
  const [reflectionTheme, setReflectionTheme] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const threadId = await onCreateThread(topic, {
        isReflectionThread,
        reflectionTheme: reflectionTheme || undefined
      });
      
      if (threadId) {
        // Reset state
        setTopic("");
        setIsReflectionThread(false);
        setReflectionTheme("");
        
        // Close modal and navigate
        onClose();
        router.push(`/thread/${threadId}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const isValid = Boolean(topic.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>Create New Conversation</ModalHeader>
      <ModalBody>
        <Input size="md" isDisabled={isCreating}>
          <InputField
            value={topic}
            onChangeText={setTopic}
            placeholder="Enter conversation topic..."
            className="min-h-[44px] py-3"
          />
        </Input>
        
        {/* Add reflection type option */}
        <View className="mt-4">
          <Text className="text-sm font-medium mb-2">Conversation Type:</Text>
          <RadioGroup
            value={isReflectionThread ? "reflection" : "standard"}
            onChange={(value) => setIsReflectionThread(value === "reflection")}
          >
            <Radio value="standard" className="mb-2">
              <RadioIndicator>
                <RadioIcon>
                  <View className="h-2 w-2 rounded-full bg-primary-500" />
                </RadioIcon>
              </RadioIndicator>
              <RadioLabel className="ml-2">Standard Message</RadioLabel>
            </Radio>
            <Radio value="reflection">
              <RadioIndicator>
                <RadioIcon>
                  <View className="h-2 w-2 rounded-full bg-primary-500" />
                </RadioIcon>
              </RadioIndicator>
              <RadioLabel className="ml-2">Reflection Session</RadioLabel>
            </Radio>
          </RadioGroup>
        </View>
        
        {/* Show theme selector only for reflection threads */}
        {isReflectionThread && (
          <View className="mt-4">
            <Text className="text-sm font-medium mb-2">Focus Area (optional):</Text>
            <Select
              onValueChange={setReflectionTheme}
              selectedValue={reflectionTheme}
            >
              <SelectTrigger className="border border-outline-300 rounded-md h-12">
                <SelectInput placeholder="Select a focus area" />
                <SelectIcon mr="$3">
                  <ChevronDownIcon size={20} />
                </SelectIcon>
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  <SelectItem label="General Well-being" value="well-being" />
                  <SelectItem label="Managing Stress" value="stress" />
                  <SelectItem label="Relationships" value="relationships" />
                  <SelectItem label="Self-discovery" value="self-discovery" />
                </SelectContent>
              </SelectPortal>
            </Select>
          </View>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onPress={onClose} className="mr-2">
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button className="min-w-[100px]" disabled={!isValid || isCreating} onPress={handleCreate}>
          {isCreating ? <LoadingButtonSpinner /> : <ButtonText>Create</ButtonText>}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
