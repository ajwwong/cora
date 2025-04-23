import { MicIcon, SendIcon, StopCircleIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import { TextareaResizable, TextareaResizableInput } from "@/components/textarea-resizable";
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
}: ChatMessageInputProps) {
  // Add a pulsing animation for recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
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
        ])
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
    <View className="flex-row items-center bg-background-0 p-3">
      <Pressable 
        onPress={() => {
          console.log("Record button pressed via Pressable");
          onAttachment();
        }}
        className={`mr-3 aspect-square rounded-md p-3 ${
          isRecording 
            ? "bg-red-500" 
            : "bg-gray-200"
        }`}
        disabled={isSending || disabled}
        accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
        style={({ pressed }) => [
          {
            backgroundColor: pressed 
              ? (isRecording ? '#b71c1c' : '#e0e0e0') 
              : (isRecording ? '#ef4444' : '#f3f4f6'),
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        {isRecording ? (
          <StopCircleIcon size={24} color="white" />
        ) : (
          <MicIcon size={24} color="#374151" />
        )}
      </Pressable>
      <View className="flex-1 relative">
        {isRecording && (
          <Animated.View 
            style={{ 
              position: 'absolute',
              top: 4,
              right: 8,
              zIndex: 10,
              transform: [{ scale: pulseAnim }]
            }}
          >
            <View className="bg-red-500 rounded-full p-1 flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-white mr-1" />
              <Text className="text-white text-xs">{recordingDuration}s</Text>
            </View>
          </Animated.View>
        )}
        <TextareaResizable size="md" className="flex-1" isDisabled={isSending || disabled || isRecording}>
          <TextareaResizableInput
            placeholder={
              isRecording 
                ? "Recording audio..." 
                : isSending 
                  ? "Sending..." 
                  : "Type a message..."
            }
            value={message}
            onChangeText={setMessage}
            className="min-h-10 border-outline-300 px-3"
            editable={!isRecording}
          />
        </TextareaResizable>
      </View>
      <Button
        variant="solid"
        size="md"
        onPress={() => onSend()}
        disabled={(!message.trim() || isSending || disabled || isRecording)}
        className={`ml-3 aspect-square rounded-full p-2 disabled:bg-background-300 ${
          isReflectionThread ? "bg-primary-500" : "bg-success-500"
        }`}
      >
        <ButtonIcon as={SendIcon} size="md" className="text-typography-0" />
      </Button>
    </View>
  );
}
