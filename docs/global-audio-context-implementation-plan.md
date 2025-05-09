# Global Audio Context Implementation Plan

## Overview

This document outlines a plan to implement a global audio context system in the Cora app to ensure only one audio file can play at a time across the entire application. Currently, the app has a thread-level audio management system, but it has limitations that allow multiple audio files to play simultaneously.

## Current Implementation

The current audio playback implementation has the following limitations:

1. **Thread-scoped coordination**: Audio playback is managed at the thread level, with no app-wide coordination
2. **Multiple sound instances**: Each `MinimalAudioPlayer` component maintains its own `Audio.Sound` object
3. **Async race conditions**: State updates about which audio is currently playing don't propagate quickly enough
4. **Incomplete stop mechanism**: The app relies on components to "stop themselves" without an explicit stop call

## Implementation Goals

1. Create a centralized audio playback system that ensures only one audio plays at a time
2. Maintain existing features (play/pause toggling, autoplay functionality)
3. Improve resource management by using a single audio instance
4. Minimize changes to the existing component structure

## Files to Modify

1. New file: `/contexts/GlobalAudioContext.tsx`
2. Update: `/app/_layout.tsx`
3. Update: `/components/MinimalAudioPlayer.tsx`
4. Update: `/components/ChatMessageBubble.tsx`
5. Update: `/app/(app)/thread/[id].tsx` (minimal changes)

## Implementation Steps

### 1. Create GlobalAudioContext.tsx

Create a new file `/contexts/GlobalAudioContext.tsx` with the following content:

```tsx
import { Audio } from "expo-av";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

// Define the context shape
interface GlobalAudioContextType {
  playingId: string | null;
  playingThreadId: string | null;
  isPlaying: boolean;
  play: (id: string, threadId: string, audioData: string) => Promise<void>;
  stop: () => Promise<void>;
}

// Create context with default values
const GlobalAudioContext = createContext<GlobalAudioContextType>({
  playingId: null,
  playingThreadId: null,
  isPlaying: false,
  play: async () => {},
  stop: async () => {},
});

// Provider component
export function GlobalAudioProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingThreadId, setPlayingThreadId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Clean up sound when component unmounts
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  // Stop any currently playing audio
  const stop = useCallback(async () => {
    if (soundRef.current) {
      try {
        console.log("Stopping audio playback");
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (err) {
        console.error("Error stopping audio:", err);
      } finally {
        soundRef.current = null;
      }
    }
    setIsPlaying(false);
    setPlayingId(null);
    setPlayingThreadId(null);
  }, []);

  // Play audio with the given ID
  const play = useCallback(async (id: string, threadId: string, audioData: string) => {
    console.log(`Playing audio ID: ${id} in thread: ${threadId}`);
    
    // If already playing, stop it first
    if (soundRef.current) {
      await stop();
      
      // If the same audio, just stop (toggle behavior)
      if (id === playingId) {
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      // Create a data URI from the base64 audio data
      const base64Audio = `data:audio/mp3;base64,${audioData}`;
      
      // Create and play the sound
      console.log("Creating new sound object");
      const { sound } = await Audio.Sound.createAsync(
        { uri: base64Audio },
        { shouldPlay: true },
        (status) => {
          // Update playing state when playback completes
          if (status.isLoaded && (status.didJustFinish || 
             (status.positionMillis === status.durationMillis && status.durationMillis > 0))) {
            console.log("Audio playback completed");
            setIsPlaying(false);
          }
        }
      );
      
      // Store the sound reference
      soundRef.current = sound;
      
      // Update state
      setPlayingId(id);
      setPlayingThreadId(threadId);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      setIsLoading(false);
    }
  }, [stop, playingId]);

  return (
    <GlobalAudioContext.Provider value={{ 
      playingId, 
      playingThreadId, 
      isPlaying, 
      play, 
      stop 
    }}>
      {children}
    </GlobalAudioContext.Provider>
  );
}

// Custom hook for easier usage
export const useGlobalAudio = () => useContext(GlobalAudioContext);
```

### 2. Update app/_layout.tsx

Update the app layout to include the GlobalAudioProvider:

```tsx
// In _layout.tsx
import { GlobalAudioProvider } from "@/contexts/GlobalAudioContext";

// In the return statement, add GlobalAudioProvider to the provider tree
return (
  <GluestackUIProvider mode={colorScheme}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar />
      <SafeAreaView className="h-full bg-background-0 md:w-full">
        <MedplumProvider medplum={medplum}>
          <NotificationsProvider>
            <UserPreferencesProvider>
              <GlobalAudioProvider>
                <GestureHandlerRootView className="flex-1">
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: "none",
                    }}
                  />
                </GestureHandlerRootView>
              </GlobalAudioProvider>
            </UserPreferencesProvider>
          </NotificationsProvider>
        </MedplumProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  </GluestackUIProvider>
);
```

### 3. Update MinimalAudioPlayer.tsx

Modify the MinimalAudioPlayer component to use the global audio context:

```tsx
import { useGlobalAudio } from "@/contexts/GlobalAudioContext";

// Update the props interface to include threadId
interface MinimalAudioPlayerProps {
  audioData: string;
  messageId: string;       // Add this prop
  threadId: string;        // Add this prop
  isAudioPlaying?: boolean;
  isCurrentPlayingMessage?: boolean;
  isAutoplayed?: boolean;
  isMostRecentAudioMessage?: boolean;
  messageText?: string;
  messageRole?: string;
  messageSentAt?: Date;
  onAudioPlay?: () => void;
  onAudioStop?: () => void;
  markAsAutoplayed?: () => void;
}

export function MinimalAudioPlayer({
  audioData,
  messageId,            // Use the new prop
  threadId,             // Use the new prop
  isAudioPlaying,
  isCurrentPlayingMessage,
  isAutoplayed,
  isMostRecentAudioMessage,
  messageText,
  messageRole,
  messageSentAt,
  onAudioPlay,
  onAudioStop,
  markAsAutoplayed,
}: MinimalAudioPlayerProps) {
  const { playingId, isPlaying: globalIsPlaying, play, stop } = useGlobalAudio();
  const [isLoading, setIsLoading] = useState(false);
  const { isAutoplayEnabled } = useUserPreferences();
  const isFirstRender = useRef(true);

  // Determine if this specific message is playing
  const isThisPlaying = playingId === messageId && globalIsPlaying;
  
  // Local state for UI responsiveness
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  
  // Keep local state in sync with global state
  useEffect(() => {
    setLocalIsPlaying(isThisPlaying);
  }, [isThisPlaying]);
  
  // Handle play/pause button click
  const handlePlay = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isThisPlaying) {
        // If already playing, stop it
        await stop();
        onAudioStop?.();
      } else {
        // Play this audio
        await play(messageId, threadId, audioData);
        onAudioPlay?.();
        markAsAutoplayed?.();
      }
    } catch (error) {
      console.error("Error handling play/pause:", error);
    } finally {
      setIsLoading(false);
    }
  }, [messageId, threadId, audioData, isThisPlaying, play, stop, onAudioPlay, onAudioStop, markAsAutoplayed]);

  // Autoplay logic
  useEffect(() => {
    // Similar to existing autoplay logic, but use global audio context
    // ...existing autoplay logic here...
    // When time to autoplay:
    const shouldAutoplay = /* existing conditions */;
    
    if (shouldAutoplay) {
      const timer = setTimeout(() => {
        play(messageId, threadId, audioData).catch(console.error);
        onAudioPlay?.();
        markAsAutoplayed?.();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAutoplayEnabled, messageId, threadId, audioData, isThisPlaying, /* other deps */]);

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePlay} disabled={isLoading} style={styles.playButton}>
        {isLoading ? (
          <LoadingButtonSpinner />
        ) : localIsPlaying ? (
          <Pause size={16} color="#ffffff" />
        ) : (
          <Play size={16} color="#ffffff" />
        )}
      </Pressable>
    </View>
  );
}
```

### 4. Update ChatMessageBubble.tsx

Update the ChatMessageBubble component to pass the required props to MinimalAudioPlayer:

```tsx
// In ChatMessageBubble.tsx
// Update the props where MinimalAudioPlayer is rendered

{message.audioData && (
  <MinimalAudioPlayer
    audioData={message.audioData}
    messageId={message.id}           // Add this prop
    threadId={threadId}              // Add this prop - you'll need to add threadId to the component props
    isAudioPlaying={isAudioPlaying}
    isCurrentPlayingMessage={isCurrentPlayingMessage}
    isAutoplayed={isAutoplayed}
    isMostRecentAudioMessage={isMostRecentAudioMessage}
    messageText={message.text}
    messageRole={message.role}
    messageSentAt={message.sentAt}
    onAudioPlay={onAudioPlay}
    onAudioStop={onAudioStop}
    markAsAutoplayed={markAsAutoplayed}
  />
)}
```

### 5. Update Thread Page

The thread page (`/app/(app)/thread/[id].tsx`) can be simplified since most audio state management is now handled by the global context. You'll need to update the props passed to ChatMessageList and ChatMessageBubble.

## Testing Plan

After implementation, test the following scenarios:

1. **Basic functionality**:
   - Play an audio message and verify it plays correctly
   - Play another audio message in the same thread and verify the first one stops
   - Press play on a playing message and verify it stops (toggle behavior)

2. **Cross-thread testing**:
   - Open two different chat threads in different tabs/windows
   - Play an audio in one thread, then play another in the second thread
   - Verify that the first audio stops when the second starts

3. **Autoplay testing**:
   - Verify that autoplay still works with the new implementation
   - Ensure autoplay stops any currently playing audio

4. **Edge cases**:
   - Test rapid clicking on multiple audio messages
   - Test playing audio while navigating between threads
   - Verify proper resource cleanup when leaving the app or closing threads

## Benefits

1. **Improved UX**: Users will never hear multiple audio files playing simultaneously
2. **Resource efficiency**: Only one audio instance is active at a time
3. **Better state management**: Centralized audio state is easier to reason about
4. **Simpler component logic**: Audio player components become simpler, focused on UI

## Fallback Plan

If any issues arise with the new implementation, we can revert to the current thread-level system while addressing specific bugs:

1. Add explicit stop calls in the `handleAudioPlay` function
2. Improve synchronization of the `isPlaying` and `currentPlayingMessageId` states
3. Add better error handling for audio playback

However, the global context approach should provide a more robust solution that addresses the root causes of the current issues.