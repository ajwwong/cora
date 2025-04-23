# AI-Powered Therapeutic Experience Implementation Plan

This document outlines the plan to transform the medplum-chat-app into an AI-powered therapeutic experience, similar to the client-facing SecureHealth reflection guide, while leveraging the existing bots in the progress2-base implementation.

## 1. Overview

The goal is to enhance the existing chat application with AI therapeutic capabilities, maintaining the robust thread management while adding specialized reflection features. The application will use the same FHIR data model and bot infrastructure that powers the SecureHealth reflection guide.

## 2. Architecture and Data Model

### 2.1 Core Data Model Extensions

Extend the existing ChatMessage and Thread classes to support reflection guide functionality:

```typescript
// In models/chat.ts
export class ChatMessage {
  // Existing properties...
  
  // Add role property for AI compatibility
  get role(): 'user' | 'assistant' {
    return this.senderType === 'Patient' ? 'user' : 'assistant';
  }
  
  // Add audio data accessor
  get audioData(): string | undefined {
    // Check for reflection guide extension first
    const audioExt = this.originalCommunication.extension?.find(e => 
      e.url === 'https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data'
    );
    if (audioExt?.valueString) return audioExt.valueString;
    
    // Then check for attachment
    return this.attachment?.data;
  }
  
  // Add transcription placeholder detection
  get isTranscriptionPlaceholder(): boolean {
    return this.text === '[Audio message - Transcribing...]';
  }
  
  get audioContentType(): string | undefined {
    const typeExt = this.originalCommunication.extension?.find(e => 
      e.url === 'https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-content-type'
    );
    return typeExt?.valueString || this.attachment?.contentType || 'audio/wav';
  }
}

export class Thread {
  // Existing properties...
  
  // Add reflection-specific properties
  get isReflectionThread(): boolean {
    return this.originalCommunication.extension?.some(e => 
      e.url === 'https://progressnotes.app/fhir/StructureDefinition/reflection-thread'
    ) ?? false;
  }
  
  get reflectionTheme(): string | undefined {
    return this.originalCommunication.extension?.find(e => 
      e.url === 'https://progressnotes.app/fhir/StructureDefinition/reflection-themes'
    )?.valueString;
  }
  
  // For Claude messaging format
  getClaudeMessages(): { role: string; content: string }[] {
    return this.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
  }
}
```

### 2.2 Audio Recording

Create a custom hook for audio recording:

```typescript
// hooks/useAudioRecording.tsx
import { useState, useRef, useEffect } from 'react';

export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      mediaRecorder.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      throw err;
    }
  };
  
  const stopRecording = async (): Promise<Blob> => {
    if (!mediaRecorder.current) {
      throw new Error('No recording in progress');
    }
    
    return new Promise((resolve) => {
      mediaRecorder.current!.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setIsRecording(false);
        resolve(blob);
      };
      
      mediaRecorder.current.stop();
    });
  };
  
  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording
  };
}
```

## 3. User Interface Enhancements

### 3.1 Enhanced Create Thread Modal

Add reflection-specific options to the thread creation modal:

```typescript
// In components/CreateThreadModal.tsx
export function CreateThreadModal({ isOpen, onClose, onCreateThread }: CreateThreadModalProps) {
  const [topic, setTopic] = useState("");
  const [isReflectionThread, setIsReflectionThread] = useState(false);
  const [reflectionTheme, setReflectionTheme] = useState("");
  // ...existing code
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>Create New Conversation</ModalHeader>
      <ModalBody>
        <Input /* existing code */ />
        
        {/* Add reflection type option */}
        <View className="mt-4">
          <Text className="text-sm font-medium mb-2">Conversation Type:</Text>
          <RadioGroup
            value={isReflectionThread ? "reflection" : "standard"}
            onChange={(value) => setIsReflectionThread(value === "reflection")}
          >
            <Radio value="standard" label="Standard Message" />
            <Radio value="reflection" label="Reflection Session" />
          </RadioGroup>
        </View>
        
        {/* Show theme selector only for reflection threads */}
        {isReflectionThread && (
          <View className="mt-4">
            <Text className="text-sm font-medium mb-2">Focus Area (optional):</Text>
            <Select
              placeholder="Select a focus area"
              value={reflectionTheme}
              onValueChange={setReflectionTheme}
              options={[
                { label: "General Well-being", value: "well-being" },
                { label: "Managing Stress", value: "stress" },
                { label: "Relationships", value: "relationships" },
                { label: "Self-discovery", value: "self-discovery" }
              ]}
            />
          </View>
        )}
      </ModalBody>
      <ModalFooter>
        {/* Existing buttons */}
      </ModalFooter>
    </Modal>
  );
}
```

### 3.2 Enhanced Thread List Item

Modify ThreadList to display reflection-specific data:

```typescript
// In components/ThreadList.tsx
function ThreadItem({
  thread,
  onPress,
  avatarURL,
  isPractitioner,
}: {
  thread: Thread;
  onPress: () => void;
  avatarURL: string | undefined;
  isPractitioner: boolean;
}) {
  // ...existing code
  
  return (
    <View>
      <Pressable
        /* existing props */
        className={`flex-row items-center gap-3 overflow-hidden ${
          thread.isReflectionThread ? 'bg-primary-50' : 'bg-background-0'
        } p-4 active:bg-secondary-100`}
      >
        {/* Existing avatar */}
        
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text /* existing props */>{isPractitioner ? `${thread.patientName}: ${thread.topic}` : thread.topic}</Text>
            
            {/* Show reflection theme if available */}
            {thread.reflectionTheme && (
              <View className="rounded-full bg-primary-100 px-2 py-0.5">
                <Text className="text-xs">{thread.reflectionTheme}</Text>
              </View>
            )}
            
            {/* Existing unread badge */}
          </View>
          {/* Existing text */}
        </View>
        
        {/* Show reflection guide label for reflection threads */}
        {thread.isReflectionThread && (
          <Text className="text-xs text-primary-600">Reflection Guide</Text>
        )}
        
        {/* Existing timestamp */}
      </Pressable>
      <View className="h-[1px] bg-outline-100" />
    </View>
  );
}
```

### 3.3 Enhanced Chat Message Input

Extend ChatMessageInput to support audio recording and AI processing:

```typescript
// In components/ChatMessageInput.tsx
export function ChatMessageInput({
  message,
  setMessage,
  onAttachment,
  onSend,
  isSending,
  disabled = false,
  isReflectionThread = false,
  isRecording = false,
}) {
  return (
    <View className="flex-row items-center bg-background-0 p-3">
      <Button
        variant="outline"
        size="md"
        onPress={() => onAttachment()}
        disabled={isSending || disabled}
        className={`mr-3 aspect-square border-outline-300 p-2 disabled:bg-background-300 ${
          isRecording ? "bg-red-100 border-red-300" : ""
        }`}
      >
        <ButtonIcon 
          as={isRecording ? StopIcon : MicrophoneIcon} 
          size="md" 
          className={isRecording ? "text-red-600" : "text-typography-600"} 
        />
      </Button>
      
      {/* Existing TextareaResizable */}
      
      <Button
        variant="solid"
        size="md"
        onPress={() => onSend()}
        disabled={!message.trim() || isSending || disabled}
        className={`ml-3 aspect-square rounded-full ${
          isReflectionThread ? "bg-primary-500" : "bg-success-500"
        } p-2 disabled:bg-background-300`}
      >
        <ButtonIcon as={SendIcon} size="md" className="text-typography-0" />
      </Button>
    </View>
  );
}
```

### 3.4 Welcome Walkthrough for First-Time Users

```typescript
// New component: components/WelcomeWalkthrough.tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { Button, ButtonText } from "./ui/button";
import { ScrollView } from "react-native";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface WelcomeWalkthroughProps {
  opened: boolean;
  onClose: () => void;
}

export function WelcomeWalkthrough({ opened, onClose }: WelcomeWalkthroughProps) {
  return (
    <Modal isOpen={opened} onClose={onClose}>
      <ModalHeader>Welcome to Your Reflection Guide</ModalHeader>
      <ModalBody>
        <ScrollView>
          <View className="mb-6">
            <Text className="text-lg font-bold mb-2">What is the Reflection Guide?</Text>
            <Text className="text-sm">
              The Reflection Guide is an AI-powered tool to help you explore your thoughts
              and feelings between therapy sessions. It's a safe space for personal reflection.
            </Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-lg font-bold mb-2">How it works:</Text>
            <Text className="text-sm">1. Start a new reflection session</Text>
            <Text className="text-sm">2. Type or speak your thoughts</Text>
            <Text className="text-sm">3. Receive supportive, reflective responses</Text>
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
        </ScrollView>
      </ModalBody>
      <ModalFooter>
        <Button onPress={onClose}>
          <ButtonText>Get Started</ButtonText>
        </Button>
      </ModalFooter>
    </Modal>
  );
}
```

## 4. Integration with AI Bot

### 4.1 Enhanced Chat Context with Bot Integration

Add AI processing capability to the ChatContext:

```typescript
// In contexts/ChatContext.tsx
// Add to ChatContextType interface
interface ChatContextType {
  // Existing members...
  processWithReflectionGuide: ({
    threadId,
    messageId,
    audioData,
    textInput,
  }: {
    threadId: string;
    messageId?: string;
    audioData?: string;
    textInput?: string;
  }) => Promise<void>;
}

// Implement the new method in the provider:
// Inside ChatProvider:
const processWithReflectionGuide = useCallback(
  async ({
    threadId,
    messageId,
    audioData,
    textInput,
  }: {
    threadId: string;
    messageId?: string;
    audioData?: string;
    textInput?: string;
  }) => {
    if (!profile) return;
    
    try {
      // Call the reflection-guide bot
      await medplum.executeBot(
        {
          system: 'https://progressnotes.app',
          value: 'reflection-guide'
        },
        {
          patientId: profile.id,
          threadId: threadId,
          messageId: messageId,
          audioBinaryData: audioData,
          textInput: textInput,
          config: {
            voiceModel: 'aura-2-cora-en',
            persona: 'empathetic, supportive guide',
            theme: 'general well-being and mental health'
          }
        }
      );
      
      // Refresh thread to display bot response
      await receiveThread(threadId);
    } catch (err) {
      console.error('Failed to process with reflection guide:', err);
      throw err;
    }
  },
  [medplum, profile, receiveThread]
);

// Enhanced sendMessage to support audio and AI processing
const sendMessage = useCallback(
  async ({
    threadId,
    message,
    attachment,
    processWithAI = false,
    audioData,
  }: {
    threadId: string;
    message?: string;
    attachment?: ImagePicker.ImagePickerAsset;
    processWithAI?: boolean;
    audioData?: string;
  }) => {
    if (!profile) return;
    if (!message?.trim() && !attachment && !audioData) return;
    
    try {
      let uploadedAttachment;
      if (attachment) {
        // Existing attachment upload code...
      }
      
      // Find the patient of the thread
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      
      // Create the message
      const newCommunication = await createThreadMessageComm({
        medplum,
        profile,
        patientRef: thread.subject as Reference<Patient>,
        message: message ?? "",
        threadId,
        attachment: uploadedAttachment,
        audioData: audioData,
      });
      
      // Update the map with the new communication
      setThreadCommMap((prev) => {
        const newMap = new Map(prev);
        const threadComms = newMap.get(threadId) || [];
        newMap.set(threadId, [...threadComms, newCommunication]);
        return newMap;
      });
      
      // If AI processing is requested, call the reflection guide bot
      if (processWithAI) {
        await processWithReflectionGuide({
          threadId,
          messageId: newCommunication.id,
          textInput: message,
          audioData,
        });
      }
      
      return newCommunication.id;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  },
  [medplum, profile, threads, setThreadCommMap, processWithReflectionGuide]
);
```

### 4.2 Audio Message Handling

Add support for creating messages with audio content:

```typescript
// Add to contexts/ChatContext.tsx
async function createThreadMessageComm({
  medplum,
  profile,
  patientRef,
  message,
  threadId,
  attachment,
  audioData,
}: {
  medplum: MedplumClient;
  profile: ProfileResource;
  patientRef: Reference<Patient>;
  message: string;
  threadId: string;
  attachment?: Attachment;
  audioData?: string;
}): Promise<Communication> {
  const payload: CommunicationPayload[] = [];

  // Add text message if provided
  if (message.trim()) {
    payload.push({ contentString: message.trim() });
  }

  // Add attachment if provided
  if (attachment) {
    payload.push({
      contentAttachment: attachment,
    });
  }
  
  // Create extensions for audio data if provided
  const extensions: Extension[] = [];
  if (audioData) {
    extensions.push({
      url: 'https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data',
      valueString: audioData
    });
    extensions.push({
      url: 'https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-content-type',
      valueString: 'audio/wav'
    });
  }

  return await medplum.createResource({
    resourceType: "Communication",
    status: "in-progress",
    sent: new Date().toISOString(),
    sender: createReference(profile),
    subject: patientRef,
    payload,
    partOf: [{ reference: `Communication/${threadId}` }],
    extension: extensions.length > 0 ? extensions : undefined
  } satisfies Communication);
}
```

## 5. Thread Creation with Reflection Guide Support

Enhance thread creation to support reflection threads:

```typescript
// Modified from contexts/ChatContext.tsx
const createThread = useCallback(
  async (
    topic: string, 
    options?: { 
      isReflectionThread?: boolean; 
      reflectionTheme?: string;
    }
  ) => {
    if (!topic.trim() || !profile) return;
    if (profile.resourceType !== "Patient") throw new Error("Only patients can create threads");

    // Add extensions for reflection threads
    const extensions: Extension[] = [];
    
    // Last activity extension - always added
    extensions.push({
      url: 'https://progressnotes.app/fhir/StructureDefinition/last-activity',
      valueDateTime: new Date().toISOString()
    });
    
    // Add reflection guide extensions if specified
    if (options?.isReflectionThread) {
      extensions.push({
        url: 'https://progressnotes.app/fhir/StructureDefinition/reflection-thread',
        valueBoolean: true
      });
      
      if (options.reflectionTheme) {
        extensions.push({
          url: 'https://progressnotes.app/fhir/StructureDefinition/reflection-themes',
          valueString: options.reflectionTheme
        });
      }
    }

    const newThread = await medplum.createResource<Communication>({
      resourceType: "Communication",
      status: "in-progress",
      sent: new Date().toISOString(),
      subject: createReference(profile),
      payload: [{ contentString: topic }],
      extension: extensions
    });
    
    setThreads((prev) => syncResourceArray(prev, newThread));
    setThreadCommMap((prev) => {
      return new Map([...prev, [newThread.id!, []]]);
    });

    return newThread.id;
  },
  [medplum, profile]
);
```

## 6. Modified Thread View for Reflection Sessions

Update the thread view to handle reflection sessions:

```typescript
// Modified thread/[id].tsx
import { useAudioRecording } from "../../hooks/useAudioRecording";

export default function ThreadScreen() {
  // Existing state and hooks...
  const { thread, isLoading, sendMessage } = useSingleThread({ threadId });
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Add audio recording hook
  const { 
    isRecording, 
    audioBlob, 
    startRecording, 
    stopRecording 
  } = useAudioRecording();
  
  const handleAudioToggle = async () => {
    if (isRecording) {
      setIsSending(true);
      try {
        // Stop recording and get blob
        const blob = await stopRecording();
        
        // Show transcription placeholder
        await sendMessage({
          threadId,
          message: "[Audio message - Transcribing...]",
        });
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        
        reader.onloadend = async () => {
          try {
            // Extract base64 data
            const base64data = reader.result?.toString().split(',')[1];
            if (!base64data) {
              throw new Error('Failed to convert audio to base64');
            }
            
            // Send with AI processing
            await sendMessage({
              threadId,
              audioData: base64data,
              processWithAI: thread?.isReflectionThread
            });
          } catch (error) {
            console.error('Error processing audio:', error);
          }
        };
      } catch (error) {
        console.error('Error with audio recording:', error);
      } finally {
        setIsSending(false);
      }
    } else {
      try {
        await startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };
  
  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await sendMessage({
        threadId,
        message,
        processWithAI: thread?.isReflectionThread
      });
      setMessage("");
    } finally {
      setIsSending(false);
    }
  };
  
  // The rest of the component...
  return (
    <View style={styles.container}>
      <ChatHeader
        title={thread?.topic || "Thread"}
        avatarURL={avatarURL}
        backButton
      />
      <ChatMessageList
        messages={thread?.messages || []}
        avatarURLs={avatarURLs}
        isLoading={isLoading && !isSending}
        onSelect={setSelectedMessageId}
        selectionEnabled={Boolean(selectedMessageId)}
      />
      <ChatMessageInput
        message={message}
        setMessage={setMessage}
        onAttachment={handleAudioToggle}
        onSend={handleSend}
        isSending={isSending}
        isRecording={isRecording}
        isReflectionThread={thread?.isReflectionThread}
      />
      
      {/* Message Delete Modal - existing code */}
    </View>
  );
}
```

## 7. Implementation Timeline

### Phase 1: Core Data Model & Audio Recording (2 weeks)
- Extend data models (ChatMessage and Thread)
- Implement audio recording hook
- Create basic UI components for audio recording
- Set up FHIR extension handling

### Phase 2: Thread UI Enhancements (2 weeks)
- Enhance thread creation with reflection options
- Modify thread list to display reflection metadata
- Create welcome walkthrough
- Add reflection theme visualization

### Phase 3: Bot Integration (2 weeks)
- Connect to reflection-guide bot
- Implement audio transcription flow
- Add audio playback for bot responses
- Set up processing indicators

### Phase 4: Testing & Refinement (1-2 weeks)
- Test end-to-end reflection experience
- Optimize performance
- Add error handling
- Refine UI/UX details

## 8. Required Dependencies

- Add audio recording libraries:
  ```json
  {
    "dependencies": {
      "expo-av": "^13.0.0",
      "expo-file-system": "^15.0.0"
    }
  }
  ```

## 9. Conclusion

This implementation plan provides a detailed roadmap for transforming the medplum-chat-app into an AI-powered therapeutic experience. By leveraging the existing bots from progress2-base and the client-focused UX from SecureHealth, we can create a seamless and effective therapeutic tool while maintaining the robust capabilities of the original chat application.

The implementation balances technical requirements with user experience, focusing on:
1. Maintaining the existing thread management capabilities
2. Adding specialized reflection features
3. Integrating with the reflection-guide bot
4. Creating an intuitive, client-friendly experience

Once implemented, the application will offer patients a valuable tool for therapeutic reflection, supporting their mental health journey between professional therapy sessions.