import { useMedplumProfile } from "@medplum/react-hooks";
import { Audio } from "expo-av"; // Keep using expo-av for now
import { useVideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import { CirclePlay, FileDown, Headphones, Mic } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Alert } from "react-native";

import { FullscreenImage } from "@/components/FullscreenImage";
import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import type { ChatMessage } from "@/models/chat";
import type { AttachmentWithUrl } from "@/types/attachment";
import { formatTime } from "@/utils/datetime";
import { isMediaExpired, mediaKey, shareFile } from "@/utils/media";

interface AudioAttachmentProps {
  audioData: string;
  isAudioPlaying?: boolean;
  isCurrentPlayingMessage?: boolean;
  isAutoplayed?: boolean;
  isMostRecentAudioMessage?: boolean;
  onAudioPlay?: () => void;
  onAudioStop?: () => void;
  markAsAutoplayed?: () => void;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  avatarURL?: string | null;
  selected?: boolean;
  onSelect?: (messageId: string) => void;
  selectionEnabled?: boolean;
  // Audio control props
  isAudioPlaying?: boolean;
  isCurrentPlayingMessage?: boolean;
  isAutoplayed?: boolean;
  isMostRecentAudioMessage?: boolean;
  onAudioPlay?: () => void;
  onAudioStop?: () => void;
  markAsAutoplayed?: () => void;
}

const mediaStyles = StyleSheet.create({
  media: {
    width: 150,
    height: 266,
  },
});

const VideoAttachment = memo(
  ({ uri }: { uri: string }) => {
    const player = useVideoPlayer(uri, (player) => {
      player.pause();
      player.loop = true;
      player.bufferOptions = {
        // Reduce buffer for performance:
        minBufferForPlayback: 0,
        preferredForwardBufferDuration: 5,
      };
    });
    const videoRef = useRef<VideoView>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handlePlayPress = useCallback(() => {
      if (!player) return;
      setIsFullscreen(true);
      setTimeout(() => {
        videoRef.current?.enterFullscreen();
        player.play();
      }, 100);
    }, [player]);

    const handleExitFullscreen = useCallback(() => {
      player?.pause();
      setIsFullscreen(false);
    }, [player]);

    return (
      <View className="relative">
        <VideoView
          ref={videoRef}
          style={mediaStyles.media}
          player={player}
          nativeControls={isFullscreen}
          onFullscreenExit={handleExitFullscreen}
        />
        <Pressable
          onPress={handlePlayPress}
          className="absolute inset-0 items-center justify-center bg-background-dark/50 dark:bg-background-dark/90"
        >
          <Icon as={CirclePlay} size="xl" className="text-white" />
        </Pressable>
      </View>
    );
  },
  (oldProps: { uri: string }, newProps: { uri: string }) =>
    mediaKey(oldProps.uri) === mediaKey(newProps.uri) && !isMediaExpired(oldProps.uri),
);
VideoAttachment.displayName = "VideoAttachment";

// This interface is already defined on lines 22-31

function AudioAttachment({
  audioData,
  isAudioPlaying,
  isCurrentPlayingMessage,
  isAutoplayed,
  isMostRecentAudioMessage,
  onAudioPlay,
  onAudioStop,
  markAsAutoplayed,
}: AudioAttachmentProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isAutoplayEnabled } = useUserPreferences();
  const isFirstRender = useRef(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Local playing state synced with thread-level state
  const isPlaying = isCurrentPlayingMessage && isAudioPlaying;

  // Define handlePlay first so we can use it in useEffect
  const handlePlay = useCallback(async () => {
    // If already playing, stop it
    if (isPlaying && sound) {
      await sound.stopAsync();
      onAudioStop?.();

      // Clear interval if we're stopping
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      return;
    }

    // If another audio is playing, thread controller will handle stopping it

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
              setPosition(0);

              // Clear interval when finished
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
            }
          },
        );

        // Get the duration
        const status = await newSound.getStatusAsync();
        if (status.isLoaded) {
          setDuration(status.durationMillis || 0);
        }

        setSound(newSound);

        // Start the progress interval
        progressIntervalRef.current = setInterval(async () => {
          if (newSound) {
            const status = await newSound.getStatusAsync();
            if (status.isLoaded) {
              setPosition(status.positionMillis);
            }
          }
        }, 100);
      } else {
        // Otherwise, play the existing sound
        await sound.playAsync();

        // Start the progress interval
        progressIntervalRef.current = setInterval(async () => {
          if (sound) {
            const status = await sound.getStatusAsync();
            if (status.isLoaded) {
              setPosition(status.positionMillis);
            }
          }
        }, 100);
      }

      // Notify thread controller that this audio is playing
      onAudioPlay?.();
      // Mark this as autoplayed so it won't autoplay again
      markAsAutoplayed?.();
    } catch (error) {
      console.error("Error playing audio:", error);
      Alert.alert("Error", "Failed to play audio. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [audioData, sound, isPlaying, onAudioPlay, onAudioStop, markAsAutoplayed]);

  // Stop playback if this message was playing but is no longer the current playing message
  useEffect(() => {
    if (sound && !isCurrentPlayingMessage && isPlaying) {
      sound.stopAsync();

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [sound, isCurrentPlayingMessage, isPlaying]);

  // Cleanup function for the sound object and interval
  useEffect(() => {
    return () => {
      // Clean up sound
      if (sound) {
        sound.unloadAsync();
      }

      // Clean up interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [sound]);

  // Simpler autoplay logic based on SecureHealth's model
  // Autoplay is now controlled by isAutoplayEnabled only, without tracking message-specific status
  useEffect(() => {
    console.log(`Audio message: autoplay enabled=${isAutoplayEnabled}`);

    // Only autoplay if autoplay is enabled in user preferences
    if (isAutoplayEnabled && isCurrentPlayingMessage === undefined) {
      console.log("Attempting to autoplay audio message based on global setting");

      // Short delay to ensure UI and audio data are fully loaded
      const timer = setTimeout(() => {
        console.log("Executing autoplay for audio message");
        handlePlay();
      }, 500);

      return () => clearTimeout(timer);
    }

    // Always set this to false after the first render
    isFirstRender.current = false;
  }, [isAutoplayEnabled, handlePlay, isCurrentPlayingMessage]);

  // Calculate progress percentage
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View className="my-1 flex-row items-center rounded-xl bg-background-100 p-2">
      {/* Play/Pause Button */}
      <Pressable
        onPress={handlePlay}
        disabled={isLoading}
        className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${isPlaying ? "bg-primary-500" : "bg-primary-400"}`}
      >
        {isLoading ? (
          <LoadingButtonSpinner />
        ) : (
          <Icon as={isPlaying ? Headphones : Mic} size="sm" className="text-typography-0" />
        )}
      </Pressable>

      {/* Progress Bar and Timer */}
      <View className="flex-1">
        {/* Waveform/Progress Bar */}
        <View className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-background-200">
          <View className="h-full rounded-full bg-primary-500" style={{ width: `${progress}%` }} />
        </View>

        {/* Duration Text */}
        <View className="flex-row justify-between">
          <Text className="text-xs text-typography-500">
            {`${Math.floor(position / 60000)}:${String(Math.floor((position / 1000) % 60)).padStart(2, "0")}`}
          </Text>
          <Text className="text-xs text-typography-500">
            {`${Math.floor(duration / 60000)}:${String(Math.floor((duration / 1000) % 60)).padStart(2, "0")}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FileAttachment({ attachment }: { attachment: AttachmentWithUrl }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleShare = useCallback(async () => {
    setIsDownloading(true);
    try {
      await shareFile(attachment);
    } catch (_error) {
      Alert.alert("Error", "Failed to share file, please try again", [{ text: "OK" }]);
    } finally {
      setIsDownloading(false);
    }
  }, [attachment]);

  return (
    <Button
      className="bg-tertiary-500"
      variant="solid"
      onPress={handleShare}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <LoadingButtonSpinner />
      ) : (
        <ButtonIcon as={FileDown} className="text-typography-100" />
      )}
      <ButtonText className="text-sm text-typography-100">
        {attachment.title || "Attachment"}
      </ButtonText>
    </Button>
  );
}

export function ChatMessageBubble({
  message,
  avatarURL,
  selected = false,
  onSelect,
  selectionEnabled = false,
  // Audio control props
  isAudioPlaying,
  isCurrentPlayingMessage,
  isAutoplayed,
  isMostRecentAudioMessage,
  onAudioPlay,
  onAudioStop,
  markAsAutoplayed,
}: ChatMessageBubbleProps) {
  const profile = useMedplumProfile();
  const isPatientMessage = message.senderType === "Patient";
  const isCurrentUser = message.senderType === profile?.resourceType;
  const hasImage = message.attachment?.contentType?.startsWith("image/");
  const hasVideo = message.attachment?.contentType?.startsWith("video/");
  const hasAudio = !!message.audioData;

  // Check if this is a message from the AI assistant
  const isAIMessage = !isCurrentUser && !isPatientMessage;

  // For determining if this is a new message (for autoplay)
  // const isRecentMessage = Date.now() - new Date(message.sentAt).getTime() < 10000; // Within last 10 seconds

  const wrapperAlignment = isCurrentUser ? "self-end" : "self-start";
  const bubbleColor = isPatientMessage
    ? "bg-secondary-200"
    : isAIMessage
      ? "bg-primary-50"
      : "bg-tertiary-200";
  const borderColor = isPatientMessage
    ? "border-secondary-300"
    : isAIMessage
      ? "border-primary-200"
      : "border-tertiary-300";
  const flexDirection = isCurrentUser ? "flex-row-reverse" : "flex-row";

  const handleLongPress = useCallback(() => {
    if (onSelect) {
      onSelect(message.id);
    }
  }, [message.id, onSelect]);

  const handlePress = useCallback(() => {
    if (selectionEnabled && onSelect) {
      onSelect(message.id);
    }
  }, [message.id, onSelect, selectionEnabled]);

  // Message status indicators
  const isTranscriptionPlaceholder = message.text === "[Audio message - Transcribing...]";

  // Check if message has a status property before accessing it
  const messageStatus = (message.originalCommunication as { status?: string }).status; // Access status property safely

  const isTranscribing =
    (messageStatus === "in-progress" && hasAudio) || isTranscriptionPlaceholder;
  const isProcessing = messageStatus === "in-progress" && !hasAudio && !isTranscriptionPlaceholder;

  return (
    <Pressable
      className={`relative w-full ${wrapperAlignment}`}
      onLongPress={handleLongPress}
      onPress={handlePress}
      delayLongPress={200}
    >
      {/* Selection background */}
      {selected && <View className="absolute inset-0 bg-background-100" />}

      <View className={`max-w-[80%] ${wrapperAlignment} p-2`}>
        <View
          style={{ width: "100%" }}
          className={`rounded-xl border p-3 ${bubbleColor} ${borderColor} ${
            selected ? "border-primary-500" : ""
          } overflow-hidden`}
        >
          {/* Display the appropriate attachment or audio content */}
          {message.attachment?.url && (
            <View className="mb-1">
              {hasImage ? (
                <FullscreenImage
                  uri={message.attachment.url}
                  alt={`Attachment ${message.attachment.title}`}
                  thumbnailWidth={mediaStyles.media.width}
                  thumbnailHeight={mediaStyles.media.height}
                />
              ) : hasVideo ? (
                <VideoAttachment uri={message.attachment.url} />
              ) : (
                <FileAttachment attachment={message.attachment as AttachmentWithUrl} />
              )}
            </View>
          )}

          {/* Audio attachment */}
          {hasAudio && (
            <View className="mb-1">
              <AudioAttachment
                audioData={message.audioData!}
                isAudioPlaying={isAudioPlaying}
                isCurrentPlayingMessage={isCurrentPlayingMessage}
                isAutoplayed={isAutoplayed}
                isMostRecentAudioMessage={isMostRecentAudioMessage}
                onAudioPlay={onAudioPlay}
                onAudioStop={onAudioStop}
                markAsAutoplayed={markAsAutoplayed}
              />
            </View>
          )}

          {/* Status indicators */}
          {isTranscribing && (
            <View className="mb-2 flex-row items-center gap-2">
              <LoadingButtonSpinner />
              <Text className="text-sm italic text-typography-500">Transcribing audio...</Text>
            </View>
          )}
          {/* Processing indicator removed */}

          {/* Message text - don't show if it's just the placeholder text */}
          {Boolean(message.text) && !isTranscriptionPlaceholder && (
            <Text
              style={{
                maxWidth: "100%",
                flexShrink: 1,
              }}
              className="max-w-full text-typography-900"
            >
              {message.text}
            </Text>
          )}

          {/* Timestamp */}
          <Text className="mt-1 text-xs text-typography-600">{formatTime(message.sentAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}
