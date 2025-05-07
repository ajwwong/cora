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
  onAudioPlay,
  onAudioStop,
  markAsAutoplayed,
}: MinimalAudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const { isAutoplayEnabled } = useUserPreferences();
  const isFirstRender = useRef(true);

  // Local playing state synced with thread-level state
  const isPlaying = isCurrentPlayingMessage && isAudioPlaying;

  // No need for duration formatting anymore

  // Define handlePlay first so we can use it in useEffect
  const handlePlay = useCallback(async () => {
    // If already playing, stop it
    if (isPlaying && sound) {
      await sound.stopAsync();
      onAudioStop?.();
      return;
    }

    setIsLoading(true);
    try {
      // If we don't have a sound object yet, create one
      if (!sound) {
        // Convert base64 to URI
        const base64Audio = `data:audio/mp3;base64,${audioData}`;
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: base64Audio },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.positionMillis === status.durationMillis) {
              onAudioStop?.();
            }
          },
        );

        // Get the duration
        const status = await newSound.getStatusAsync();
        if (status.isLoaded) {
          setDuration(status.durationMillis || 0);
        }

        setSound(newSound);
      } else {
        // Otherwise, play the existing sound
        await sound.playAsync();
      }

      // Notify thread controller that this audio is playing
      onAudioPlay?.();
      // Mark this as autoplayed so it won't autoplay again
      markAsAutoplayed?.();
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
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

  // Autoplay logic
  useEffect(() => {
    if (isAutoplayEnabled && isCurrentPlayingMessage === undefined) {
      const timer = setTimeout(() => {
        handlePlay();
      }, 500);
      return () => clearTimeout(timer);
    }
    isFirstRender.current = false;
  }, [isAutoplayEnabled, handlePlay, isCurrentPlayingMessage]);

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePlay} disabled={isLoading} style={styles.playButton}>
        {isLoading ? (
          <LoadingButtonSpinner />
        ) : isPlaying ? (
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
