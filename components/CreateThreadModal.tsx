import { useRouter } from "expo-router";
import { useState } from "react";

import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/Modal";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

interface CreateThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateThread: (
    topic: string,
    options?: {
      isReflectionThread?: boolean;
      reflectionTheme?: string;
    },
  ) => Promise<string | undefined>;
}

export function CreateThreadModal({ isOpen, onClose, onCreateThread }: CreateThreadModalProps) {
  const [topic, setTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const threadId = await onCreateThread(topic, {
        isReflectionThread: true, // Always a reflection thread
      });

      if (threadId) {
        // Reset state
        setTopic("");

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
      <ModalHeader>Start New Reflection Session</ModalHeader>
      <ModalBody>
        <Text className="mb-2 text-typography-600">
          Begin a guided reflection session. Start by entering a general topic or area you'd like to
          reflect on.
        </Text>
        <Input size="md" isDisabled={isCreating}>
          <InputField
            value={topic}
            onChangeText={setTopic}
            placeholder="Enter reflection topic..."
            className="min-h-[44px] py-3"
          />
        </Input>

        {/* No focus area selector - using topic as the only input */}
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
