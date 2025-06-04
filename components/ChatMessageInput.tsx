import { MicIcon, SendIcon, StopCircleIcon } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, TextInput } from "react-native";

// Removed TextareaResizable import - replacing with native TextInput
import { Button, ButtonIcon } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";

interface ChatMessageInputProps {
  message: string;
  setMessage: (message: string) => void;
  onAttachment: () => Promise<void>;
  onSend: () => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
  isRecording?: boolean;
  isReflectionThread?: boolean;
  recordingDuration?: number;
  isBotProcessing?: boolean;
  remainingFreeMessages?: number;
  hasPremium?: boolean;
}

export function ChatMessageInput({
  message,
  setMessage,
  onAttachment,
  onSend,
  isSending,
  disabled = false,
  isRecording = false,
  isReflectionThread = false,
  recordingDuration = 0,
  isBotProcessing = false,
  remainingFreeMessages = 0,
  hasPremium = false,
}: ChatMessageInputProps) {
  // Add a pulsing animation for recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Add ref for text input to manage focus
  const textInputRef = useRef<TextInput>(null);
  // State for auto-expanding text input height
  const [inputHeight, setInputHeight] = useState(40);

  // Debug logging for input visibility state
  const isInputDisabled = isSending || disabled || isRecording || isBotProcessing;

  // Focus management: blur when disabled, only focus after recording
  const prevRecordingRef = useRef(isRecording);
  const prevDisabledRef = useRef(isInputDisabled);

  useEffect(() => {
    const wasRecording = prevRecordingRef.current;
    const wasDisabled = prevDisabledRef.current;
    const isNowNotRecording = !isRecording;
    const isNowDisabled = isInputDisabled;
    const isNowEnabled = !isInputDisabled;

    // Blur input when it becomes disabled (removes cursor during "Waiting for response...")
    if (!wasDisabled && isNowDisabled) {
      textInputRef.current?.blur();
    }

    // Only refocus if we just finished recording AND input is not disabled
    if (wasRecording && isNowNotRecording && isNowEnabled) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }

    prevRecordingRef.current = isRecording;
    prevDisabledRef.current = isInputDisabled;
  }, [isRecording, isInputDisabled]);

  // Set up pulsing animation when recording
  useEffect(() => {
    // Store animation reference for cleanup
    let animationRef: Animated.CompositeAnimation | null = null;

    if (isRecording) {
      // Create the animation sequence but don't start it yet
      animationRef = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1500, // Slower animation (1.5s instead of 1s)
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500, // Slower animation (1.5s instead of 1s)
            useNativeDriver: true,
          }),
        ]),
      );

      // Start the animation
      animationRef.start();
    } else {
      // Reset the animation value when not recording
      pulseAnim.setValue(1);
    }

    // Clean up animation on unmount or when dependency changes
    return () => {
      if (animationRef) {
        animationRef.stop();
      }
      pulseAnim.stopAnimation();
    };
  }, [isRecording, pulseAnim]);
  return (
    <View
      className="flex-row items-center bg-background-0 p-3"
      style={{
        backgroundColor: "#f9fafb", // Light gray background
        minHeight: 60, // Ensure reasonable height
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb", // Subtle top border
        // Defensive positioning to prevent hiding
        position: "relative",
        zIndex: 1,
      }}
    >
      <Pressable
        onPress={() => {
          console.log("Record button pressed via Pressable");
          onAttachment();
        }}
        className={`mr-3 aspect-square rounded-md p-3 ${
          isRecording ? "bg-red-500" : "bg-gray-200"
        }`}
        disabled={isSending || disabled || isBotProcessing}
        accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
        aria-label={
          isRecording
            ? "Stop recording"
            : !hasPremium
              ? `Start recording (${remainingFreeMessages} left)`
              : "Start recording"
        }
        style={({ pressed }) => [
          {
            backgroundColor: pressed
              ? isRecording
                ? "#b71c1c"
                : "#e0e0e0"
              : isRecording
                ? "#ef4444"
                : "#f3f4f6",
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        {isRecording ? (
          <StopCircleIcon size={24} color="white" />
        ) : (
          <>
            <MicIcon size={24} color="#374151" />
          </>
        )}
      </Pressable>
      <View className="relative flex-1">
        {isRecording && (
          <Animated.View
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              zIndex: 20,
              transform: [{ scale: pulseAnim }],
            }}
          >
            <View className="flex-row items-center rounded-full bg-red-500 p-1">
              <View className="mr-1 h-2 w-2 rounded-full bg-white" />
              <Text className="text-xs text-white">{recordingDuration}s</Text>
            </View>
          </Animated.View>
        )}
        {isBotProcessing && !isRecording && (
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              zIndex: 20,
            }}
          >
            <View className="flex-row items-center rounded-full bg-primary-500 p-1">
              <View className="mr-1 h-2 w-2 rounded-full bg-white" />
              <Text className="text-xs text-white">AI is responding...</Text>
            </View>
          </View>
        )}
        <TextInput
          ref={textInputRef}
          multiline={true}
          textAlignVertical="top"
          placeholder={
            isRecording
              ? "Recording audio..."
              : isSending
                ? "Sending..."
                : isBotProcessing
                  ? "Waiting for response..."
                  : "Type a message..."
          }
          placeholderTextColor="#9ca3af"
          value={message}
          onChangeText={setMessage}
          onContentSizeChange={(e) => {
            // Auto-expand height based on content, with min/max limits
            const newHeight = Math.max(40, Math.min(120, e.nativeEvent.contentSize.height));
            setInputHeight(newHeight);
          }}
          style={{
            flex: 1,
            height: inputHeight,
            backgroundColor: isInputDisabled ? "#f3f4f6" : "#ffffff",
            borderColor: isInputDisabled ? "#d1d5db" : "#cbd5e1",
            borderWidth: 1,
            borderRadius: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            color: "#111827",
            fontSize: 16,
            lineHeight: 20,
            // Defensive styling to ensure it's always visible
            opacity: 1,
            zIndex: 10,
          }}
          editable={!isInputDisabled}
          pointerEvents={isInputDisabled ? "none" : "auto"}
        />
      </View>
      <Button
        variant="solid"
        size="md"
        onPress={() => onSend()}
        disabled={!message.trim() || isSending || disabled || isRecording || isBotProcessing}
        className={`ml-3 aspect-square rounded-full p-2 disabled:bg-background-300 ${
          isReflectionThread ? "bg-primary-500" : "bg-success-500"
        }`}
      >
        <ButtonIcon as={SendIcon} size="md" className="text-typography-0" />
      </Button>
    </View>
  );
}
