# Voice Regeneration Feature Implementation Plan

## Overview
This document outlines the implementation plan for adding a "Regenerate Voice" feature to the Cora app, similar to the functionality available in Feel2. This feature will allow users to regenerate the text-to-speech audio for AI assistant messages.

## Background
Currently, Cora provides a minimal audio player that allows playing and pausing audio messages from the AI assistant. The Feel2 implementation includes additional functionality such as downloading audio and regenerating voice. This plan focuses on implementing the voice regeneration capability.

## Implementation Details

### 1. ChatContext Extension

Add a new `regenerateAudio` function to the `ChatContext`:

```typescript
// Add to ChatContextType interface
interface ChatContextType {
  // Existing members...
  regenerateAudio: (threadId: string, messageId: string) => Promise<boolean>;
}

// Implementation in ChatProvider
const regenerateAudio = useCallback(
  async (threadId: string, messageId: string) => {
    if (!profile) return false;
    
    // Set processing state for the thread
    setIsBotProcessingMap((prev) => new Map([...prev, [threadId, true]]));
    
    try {
      console.log(`Regenerating voice for message ${messageId} in thread ${threadId}`);
      
      // Call the reflection-guide bot with regenerateTTS flag
      const response = await medplum.executeBot(
        {
          system: "https://progressnotes.app",
          value: "reflection-guide"
        },
        {
          patientId: profile.id,
          threadId: threadId,
          messageId: messageId,
          regenerateTTS: true
        }
      );
      
      if (!response.success) {
        console.error('Voice regeneration failed:', response.error);
        return false;
      }
      
      // Refresh thread to get updated message with new audio
      await receiveThread(threadId);
      return true;
    } catch (error) {
      console.error('Error regenerating voice:', error);
      return false;
    } finally {
      // Reset processing state
      setIsBotProcessingMap((prev) => new Map([...prev, [threadId, false]]));
    }
  },
  [medplum, profile, receiveThread]
);

// Add to context value in provider
const value = {
  // Existing values...
  regenerateAudio
};
```

### 2. MinimalAudioPlayer UI Enhancement

Modify the `MinimalAudioPlayer` component to include a regenerate button:

```typescript
// In MinimalAudioPlayer.tsx
import { Pause, Play, RefreshCw } from "lucide-react-native";
import { useChatContext } from "@/contexts/ChatContext";

interface MinimalAudioPlayerProps {
  // Existing props...
  // Add needed props for regeneration
  onRegenerateStart?: () => void;
  onRegenerateComplete?: () => void;
}

export function MinimalAudioPlayer({
  // Existing props...
  onRegenerateStart,
  onRegenerateComplete,
}: MinimalAudioPlayerProps) {
  const { regenerateAudio } = useChatContext();
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Add regenerate handler
  const handleRegenerateVoice = async () => {
    if (isRegenerating) return;
    
    setIsRegenerating(true);
    onRegenerateStart?.();
    
    try {
      const success = await regenerateAudio(threadId, messageId);
      if (success) {
        // Notify parent of successful regeneration
        onRegenerateComplete?.();
      }
    } finally {
      setIsRegenerating(false);
    }
  };
  
  // In the render section, add regenerate button
  return (
    <View style={styles.container}>
      {/* Existing play button */}
      <Pressable onPress={handlePlay} disabled={isLoading} style={styles.playButton}>
        {isLoading ? (
          <LoadingButtonSpinner />
        ) : localIsPlaying ? (
          <Pause size={16} color="#ffffff" />
        ) : (
          <Play size={16} color="#ffffff" />
        )}
      </Pressable>
      
      {/* Add regenerate button - only show for AI messages */}
      {messageRole === "assistant" && (
        <Pressable 
          onPress={handleRegenerateVoice}
          disabled={isRegenerating}
          style={styles.regenerateButton}
        >
          {isRegenerating ? (
            <LoadingButtonSpinner />
          ) : (
            <RefreshCw size={14} color="#ffffff" />
          )}
        </Pressable>
      )}
    </View>
  );
}

// Add styles for regenerate button
const styles = StyleSheet.create({
  // Existing styles...
  regenerateButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(180, 160, 195, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(180, 160, 195, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
```

### 3. Thread Component Updates

Update the `ChatMessageBubble` component to pass necessary props:

```typescript
// In ChatMessageBubble.tsx
{hasAudio && (
  <View className="mt-2">
    <MinimalAudioPlayer
      audioData={message.audioData!}
      messageId={message.id}
      threadId={message.originalCommunication.partOf?.[0]?.reference?.split('/')[1] || ''}
      isAudioPlaying={isAudioPlaying}
      isCurrentPlayingMessage={isCurrentPlayingMessage}
      isAutoplayed={isAutoplayed}
      isMostRecentAudioMessage={isMostRecentAudioMessage}
      onAudioPlay={onAudioPlay}
      onAudioStop={onAudioStop}
      markAsAutoplayed={markAsAutoplayed}
      messageText={message.text}
      messageRole={message.role}
      messageSentAt={message.sentAt}
      // Add new props for regeneration
      onRegenerateStart={() => {
        // Optional: Add a visual indicator that regeneration has started
      }}
      onRegenerateComplete={() => {
        // Optional: Add a visual indicator that regeneration is complete
      }}
    />
  </View>
)}
```

### 4. Bot Update

Ensure the reflection-guide bot can handle the `regenerateTTS` flag. The bot should:

1. Find the specified message using the provided `messageId`
2. Extract the existing text content
3. Generate new audio using the text-to-speech service
4. Update the message with the new audio data (using the same extension URL)

## Testing Plan

1. **Unit Tests**:
   - Test the `regenerateAudio` function in isolation
   - Verify it correctly calls the bot with the right parameters
   - Check error handling and state management

2. **Integration Tests**:
   - Verify that the UI elements appear correctly
   - Test the regeneration flow from button click to audio update
   - Ensure the audio player works with regenerated audio

3. **Manual Testing**:
   - Test regeneration on various message types and lengths
   - Verify visual feedback during regeneration process
   - Test edge cases like network errors, missing messages, etc.

## Implementation Challenges

1. **State Management**:
   - Ensure loading states are properly managed during regeneration
   - Handle concurrent regeneration requests appropriately

2. **UI Polish**:
   - Maintain a clean, minimal UI while adding the new feature
   - Provide appropriate visual feedback during regeneration

3. **Error Handling**:
   - Gracefully handle failures in the regeneration process
   - Provide appropriate feedback to users

## Conclusion

This implementation plan outlines the approach to add a "Regenerate Voice" feature to Cora, enhancing the audio experience by allowing users to refresh AI-generated voice responses. The implementation respects the existing architecture of the application while adding this new capability in a modular way.