import { Audio } from "expo-av";
import { Pause, Play } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface MinimalAudioPlayerProps {
  audioData: string;
  isAudioPlaying?: boolean;
  isCurrentPlayingMessage?: boolean;
  isAutoplayed?: boolean;
  isMostRecentAudioMessage?: boolean;
  messageText?: string;
  messageRole?: string;
  onAudioPlay?: () => void;
  onAudioStop?: () => void;
  markAsAutoplayed?: () => void;
}

export function MinimalAudioPlayer({
  audioData,
  isAudioPlaying,
  isCurrentPlayingMessage,
  isAutoplayed,
  isMostRecentAudioMessage,
  messageText,
  messageRole,
  onAudioPlay,
  onAudioStop,
  markAsAutoplayed,
}: MinimalAudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const { isAutoplayEnabled } = useUserPreferences();
  const isFirstRender = useRef(true);

  // Local playing state synced with thread-level state with direct UI response
  const isPlaying = isCurrentPlayingMessage && isAudioPlaying;

  // Add local state to ensure UI responds immediately
  const [localIsPlaying, setLocalIsPlaying] = useState(false);

  // Keep local state in sync with parent state
  useEffect(() => {
    setLocalIsPlaying(isPlaying);
  }, [isPlaying]);

  // No need for duration formatting anymore

  // Define handlePlay first so we can use it in useEffect
  const handlePlay = useCallback(async () => {
    console.log(`[PLAY DEBUG] handlePlay called with state:`, {
      isPlaying,
      soundExists: sound ? true : false,
    });

    // If already playing, stop it
    if (isPlaying && sound) {
      console.log(`[PLAY DEBUG] Already playing, stopping sound`);
      try {
        await sound.stopAsync();
        onAudioStop?.();
      } catch (err) {
        console.error(`[PLAY DEBUG] Error stopping sound:`, err);
      }
      return;
    }

    setIsLoading(true);
    console.log(`[PLAY DEBUG] Starting audio playback process`);
    try {
      // If we don't have a sound object yet, create one
      if (!sound) {
        console.log(`[PLAY DEBUG] No sound object, creating new one`);
        // Convert base64 to URI
        const base64Audio = `data:audio/mp3;base64,${audioData}`;
        console.log(`[PLAY DEBUG] Base64 audio length:`, audioData.length);

        console.log(`[PLAY DEBUG] Creating sound with Expo AV`);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: base64Audio },
          { shouldPlay: true },
          (status) => {
            console.log(`[PLAY DEBUG] Sound status update:`, {
              isLoaded: status.isLoaded,
              isPlaying: status.isPlaying,
              position: status.positionMillis,
              duration: status.durationMillis,
              didJustFinish: status.didJustFinish,
            });

            // Either check for position matching duration OR didJustFinish flag
            if (
              status.isLoaded &&
              (status.didJustFinish ||
                (status.positionMillis === status.durationMillis && status.durationMillis > 0))
            ) {
              console.log(`[PLAY DEBUG] Sound completed playback, calling onAudioStop`);
              // Reset local state immediately for faster UI response
              setLocalIsPlaying(false);
              // Call onAudioStop to reset parent component state
              onAudioStop?.();
            }

            // Ensure UI updates as soon as playing state changes
            if (status.isLoaded && !status.isPlaying && status.positionMillis > 0) {
              console.log(`[PLAY DEBUG] Sound paused or stopped, updating UI`);
              // Reset local state immediately
              setLocalIsPlaying(false);
              // This ensures the UI reflects the actual playing state
              onAudioStop?.();
            }
          },
        );

        console.log(`[PLAY DEBUG] Sound created, getting status`);
        // Get the duration
        const status = await newSound.getStatusAsync();
        if (status.isLoaded) {
          console.log(`[PLAY DEBUG] Setting duration:`, status.durationMillis);
          setDuration(status.durationMillis || 0);
        } else {
          console.log(`[PLAY DEBUG] Sound created but not loaded properly`);
        }

        console.log(`[PLAY DEBUG] Saving sound object`);
        setSound(newSound);
      } else {
        // Otherwise, play the existing sound
        console.log(`[PLAY DEBUG] Using existing sound object`);
        await sound.playAsync();
      }

      // Set local playing state immediately for UI
      console.log(`[PLAY DEBUG] Setting localIsPlaying = true for immediate UI update`);
      setLocalIsPlaying(true);

      // Notify thread controller that this audio is playing
      console.log(`[PLAY DEBUG] Calling onAudioPlay to update parent state`);
      onAudioPlay?.();

      // Mark this as autoplayed so it won't autoplay again
      console.log(`[PLAY DEBUG] Calling markAsAutoplayed`);
      markAsAutoplayed?.();
    } catch (error) {
      console.error(`[PLAY DEBUG] Error playing audio:`, error);
    } finally {
      console.log(`[PLAY DEBUG] Finished playback initialization, setting isLoading=false`);
      setIsLoading(false);
    }
  }, [audioData, sound, isPlaying, onAudioPlay, onAudioStop, markAsAutoplayed]);

  // Stop playback if this message was playing but is no longer the current playing message
  useEffect(() => {
    if (sound && !isCurrentPlayingMessage && isPlaying) {
      sound.stopAsync();
    }
  }, [sound, isCurrentPlayingMessage, isPlaying]);

  // Cleanup function for the sound object
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Autoplay logic - only for assistant messages
  useEffect(() => {
    console.log(`[AUTOPLAY DEBUG] Component state:`, {
      isAutoplayEnabled,
      isCurrentPlayingMessage,
      isPlaying,
      isAutoplayed,
      isMostRecentAudioMessage,
      messageRole,
      messageText: messageText ? messageText.substring(0, 30) + "..." : null,
      audioDataLength: audioData ? audioData.length : 0,
      soundObject: sound ? "exists" : "null",
    });

    // Check if this is a transcription placeholder
    const isTranscriptionPlaceholder = messageText ? /Transcribing audio/.test(messageText) : false;

    // Check if this is an assistant message
    const isAssistantMessage = messageRole === "assistant";

    // Only autoplay for assistant messages that are not transcription placeholders
    if (
      isAutoplayEnabled &&
      !isPlaying &&
      isMostRecentAudioMessage &&
      !isAutoplayed &&
      isAssistantMessage && // Must be an assistant message
      !isTranscriptionPlaceholder && // Not a placeholder
      // Make sure there's actual audio data
      audioData &&
      audioData.length > 1000
    ) {
      console.log(`[AUTOPLAY DEBUG] Conditions met for autoplay, scheduling playback in 500ms`);
      const timer = setTimeout(() => {
        console.log(`[AUTOPLAY DEBUG] Timer triggered, calling handlePlay()`);
        handlePlay();
      }, 500);
      return () => {
        console.log(`[AUTOPLAY DEBUG] Cleaning up autoplay timer`);
        clearTimeout(timer);
      };
    } else {
      console.log(`[AUTOPLAY DEBUG] Autoplay conditions NOT met:`, {
        isAutoplayEnabled,
        isPlaying,
        isMostRecentAudioMessage,
        isAutoplayed,
        isAssistantMessage,
        hasAudioData: audioData && audioData.length > 1000,
        isTranscriptionPlaceholder,
      });
    }
    isFirstRender.current = false;
  }, [isAutoplayEnabled, handlePlay, isPlaying, isAutoplayed, isMostRecentAudioMessage, audioData]);

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePlay} disabled={isLoading} style={styles.playButton}>
        {isLoading ? (
          <LoadingButtonSpinner />
        ) : localIsPlaying ? ( // Use local state for more responsive UI
          <Pause size={16} color="#ffffff" />
        ) : (
          <Play size={16} color="#ffffff" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(160, 180, 195, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(160, 180, 195, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
});
