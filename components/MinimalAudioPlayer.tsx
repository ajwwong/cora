import { Pause, Play, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { useGlobalAudio } from "@/contexts/GlobalAudioContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useChatAudioRegeneration } from "@/hooks/useChatAudioRegeneration";

interface MinimalAudioPlayerProps {
  audioData: string;
  messageId: string; // Added for global audio context
  threadId: string; // Added for global audio context
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
  onRegenerateStart?: () => void;
  onRegenerateComplete?: () => void;
}

export function MinimalAudioPlayer({
  audioData,
  messageId,
  threadId,
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
  onRegenerateStart,
  onRegenerateComplete,
}: MinimalAudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { isAutoplayEnabled } = useUserPreferences();
  const isFirstRender = useRef(true);

  // Get global audio context
  const { playingId, isPlaying: globalIsPlaying, play, stop } = useGlobalAudio();

  // Get chat context for regeneration using the custom hook
  const { regenerateAudio } = useChatAudioRegeneration();

  // Determine if this specific audio is playing
  const isThisPlaying = playingId === messageId && globalIsPlaying;

  // Add local state to ensure UI responds immediately
  const [localIsPlaying, setLocalIsPlaying] = useState(false);

  // Keep local state in sync with global state
  useEffect(() => {
    setLocalIsPlaying(isThisPlaying);
  }, [isThisPlaying]);

  // Handle play/pause button press
  const handlePlay = useCallback(async () => {
    console.log(`[PLAY DEBUG] handlePlay called for message ${messageId}`);

    setIsLoading(true);
    try {
      if (isThisPlaying) {
        // If this audio is currently playing, stop it
        console.log(`[PLAY DEBUG] Already playing, stopping audio`);
        await stop();
        onAudioStop?.();
      } else {
        // Play this audio
        console.log(`[PLAY DEBUG] Starting playback for message ${messageId}`);
        await play(messageId, threadId, audioData);

        // Notify parent component
        console.log(`[PLAY DEBUG] Calling onAudioPlay to update parent state`);
        onAudioPlay?.();

        // Mark as autoplayed
        console.log(`[PLAY DEBUG] Marking as autoplayed`);
        markAsAutoplayed?.();
      }
    } catch (error) {
      console.error(`[PLAY DEBUG] Error handling audio playback:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [
    messageId,
    threadId,
    audioData,
    isThisPlaying,
    play,
    stop,
    onAudioPlay,
    onAudioStop,
    markAsAutoplayed,
  ]);

  // Autoplay logic - only for assistant messages
  useEffect(() => {
    console.log(`[AUTOPLAY DEBUG] Component state:`, {
      isAutoplayEnabled,
      isThisPlaying,
      globalPlayingId: playingId,
      isAutoplayed,
      isMostRecentAudioMessage,
      messageRole,
      messageText: messageText ? messageText.substring(0, 30) + "..." : null,
      audioDataLength: audioData ? audioData.length : 0,
      messageSentAt: messageSentAt ? messageSentAt.toString() : null,
    });

    // Check if message was sent within the last 2 minutes
    const isRecentMessage = () => {
      if (!messageSentAt) return false;

      const now = new Date();
      const diffMs = now.getTime() - messageSentAt.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      console.log(`[AUTOPLAY DEBUG] Message time difference: ${diffMinutes.toFixed(2)} minutes`);
      return diffMinutes <= 2; // Only autoplay if message is within last 2 minutes
    };

    // Check if this is a transcription placeholder
    const isTranscriptionPlaceholder = messageText ? /Transcribing audio/.test(messageText) : false;

    // Check if this is an assistant message
    const isAssistantMessage = messageRole === "assistant";

    // Check if message is recent (within last 2 minutes)
    const isRecent = isRecentMessage();

    // Only autoplay for assistant messages that are not transcription placeholders
    if (
      isAutoplayEnabled &&
      !globalIsPlaying && // No audio is currently playing anywhere in the app
      isMostRecentAudioMessage &&
      !isAutoplayed &&
      isAssistantMessage && // Must be an assistant message
      !isTranscriptionPlaceholder && // Not a placeholder
      isRecent && // Must be a recent message (within 2 minutes)
      // Make sure there's actual audio data
      audioData &&
      audioData.length > 1000
    ) {
      console.log(`[AUTOPLAY DEBUG] Conditions met for autoplay, scheduling playback in 500ms`);
      const timer = setTimeout(() => {
        console.log(`[AUTOPLAY DEBUG] Timer triggered, calling play() with global audio context`);
        // Use the global audio context's play function directly
        play(messageId, threadId, audioData)
          .then(() => {
            // After successful playback start, notify parent components
            onAudioPlay?.();
            markAsAutoplayed?.();
          })
          .catch((error) => {
            console.error(`[AUTOPLAY DEBUG] Error starting autoplay:`, error);
          });
      }, 500);
      return () => {
        console.log(`[AUTOPLAY DEBUG] Cleaning up autoplay timer`);
        clearTimeout(timer);
      };
    } else {
      console.log(`[AUTOPLAY DEBUG] Autoplay conditions NOT met:`, {
        isAutoplayEnabled,
        globalIsPlaying,
        isMostRecentAudioMessage,
        isAutoplayed,
        isAssistantMessage,
        hasAudioData: audioData && audioData.length > 1000,
        isTranscriptionPlaceholder,
      });
    }
    isFirstRender.current = false;
  }, [
    isAutoplayEnabled,
    globalIsPlaying,
    playingId,
    messageId,
    threadId,
    isAutoplayed,
    isMostRecentAudioMessage,
    audioData,
    messageRole,
    messageText,
    messageSentAt,
    play,
    onAudioPlay,
    markAsAutoplayed,
  ]);

  // Regenerate voice handler with confirmation
  const handleRegenerateVoice = useCallback(async () => {
    if (isRegenerating) return;

    // Show confirmation alert
    Alert.alert(
      "Regenerate Voice",
      "Are you sure you want to regenerate the voice for this message?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Regenerate",
          onPress: async () => {
            setIsRegenerating(true);
            onRegenerateStart?.();

            try {
              // Call the regenerateAudio function from ChatContext
              const success = await regenerateAudio(threadId, messageId);
              if (success) {
                onRegenerateComplete?.();
              }
            } catch (error) {
              console.error("Error regenerating voice:", error);
            } finally {
              setIsRegenerating(false);
            }
          },
        },
      ],
    );
  }, [
    messageId,
    threadId,
    isRegenerating,
    regenerateAudio,
    onRegenerateStart,
    onRegenerateComplete,
  ]);

  // Only show regenerate button for assistant messages
  const showRegenerateButton = messageRole === "assistant";

  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
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

      {/* Right-aligned container for regenerate button */}
      <View style={styles.rightContainer}>
        {/* Regenerate button with confirmation - only for assistant messages */}
        {showRegenerateButton && (
          <Pressable
            onPress={handleRegenerateVoice}
            disabled={isRegenerating}
            style={styles.optionsButton}
          >
            {isRegenerating ? <LoadingButtonSpinner /> : <RefreshCw size={14} color="#888888" />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Space elements to push regenerate button to the right
    width: "100%", // Take full width of parent container
  },
  leftContainer: {
    // Container for the play button
  },
  rightContainer: {
    // Container for the regenerate button, pushed to the right
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
  optionsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(180, 190, 200, 0.5)", // Lighter, more transparent color
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(180, 190, 200, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, // Reduced shadow opacity
    shadowRadius: 1,
    elevation: 1, // Reduced elevation
  },
});
