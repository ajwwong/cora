import { useMedplumProfile } from "@medplum/react-hooks";
import { Audio } from "expo-av";
import { useVideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import { CirclePlay, FileDown, Headphones, Mic, UserRound } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Alert } from "react-native";

import { FullscreenImage } from "@/components/FullscreenImage";
import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ChatMessage } from "@/models/chat";
import type { AttachmentWithUrl } from "@/types/attachment";
import { formatTime } from "@/utils/datetime";
import { isMediaExpired, mediaKey, shareFile } from "@/utils/media";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  avatarURL?: string | null;
  selected?: boolean;
  onSelect?: (messageId: string) => void;
  selectionEnabled?: boolean;
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

function AudioAttachment({ audioData }: { audioData: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Cleanup function for the sound object
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handlePlay = useCallback(async () => {
    // If already playing, stop it
    if (isPlaying && sound) {
      await sound.stopAsync();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      // If we don't have a sound object yet, create one
      if (!sound) {
        // Convert base64 to URI
        const base64Audio = `data:audio/wav;base64,${audioData}`;
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: base64Audio },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          },
        );
        setSound(newSound);
      } else {
        // Otherwise, play the existing sound
        await sound.playAsync();
      }
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      Alert.alert("Error", "Failed to play audio. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [audioData, sound, isPlaying]);

  return (
    <Button
      className={`${isPlaying ? "bg-primary-600" : "bg-tertiary-500"}`}
      variant="solid"
      onPress={handlePlay}
      disabled={isLoading}
    >
      {isLoading ? (
        <LoadingButtonSpinner />
      ) : (
        <ButtonIcon as={isPlaying ? Headphones : Mic} className="text-typography-100" />
      )}
      <ButtonText className="text-sm text-typography-100">
        {isPlaying ? "Playing Audio..." : "Play Audio"}
      </ButtonText>
    </Button>
  );
}

function FileAttachment({ attachment }: { attachment: AttachmentWithUrl }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleShare = useCallback(async () => {
    setIsDownloading(true);
    try {
      await shareFile(attachment);
    } catch {
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
}: ChatMessageBubbleProps) {
  const profile = useMedplumProfile();
  const isPatientMessage = message.senderType === "Patient";
  const isCurrentUser = message.senderType === profile?.resourceType;
  const hasImage = message.attachment?.contentType?.startsWith("image/");
  const hasVideo = message.attachment?.contentType?.startsWith("video/");
  const hasAudio = !!message.audioData;

  // Check if this is a message from the AI assistant
  const isAIMessage = !isCurrentUser && !isPatientMessage;

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
  const isTranscribing =
    (message.status === "in-progress" && hasAudio) || isTranscriptionPlaceholder;
  const isProcessing = message.status === "in-progress" && !hasAudio && !isTranscriptionPlaceholder;

  return (
    <Pressable
      className={`relative w-full ${wrapperAlignment}`}
      onLongPress={handleLongPress}
      onPress={handlePress}
      delayLongPress={200}
    >
      {/* Selection background */}
      {selected && <View className="absolute inset-0 bg-background-100" />}

      <View className={`max-w-[80%] ${wrapperAlignment} p-2 ${flexDirection} items-end gap-2`}>
        <Avatar
          size="sm"
          className={`border ${selected ? "border-primary-500" : "border-primary-200"}`}
        >
          <Icon as={UserRound} size="sm" className="stroke-typography-0" />
          {avatarURL && <AvatarImage source={{ uri: avatarURL }} />}
        </Avatar>
        <View
          className={`rounded-xl border p-3 ${bubbleColor} ${borderColor} ${
            selected ? "border-primary-500" : ""
          }`}
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
              <AudioAttachment audioData={message.audioData!} />
            </View>
          )}

          {/* Status indicators */}
          {isTranscribing && (
            <View className="mb-2 flex-row items-center gap-2">
              <LoadingButtonSpinner />
              <Text className="text-sm italic text-typography-500">Transcribing audio...</Text>
            </View>
          )}
          {isProcessing && (
            <View className="mb-2 flex-row items-center gap-2">
              <LoadingButtonSpinner />
              <Text className="text-sm italic text-typography-500">Processing message...</Text>
            </View>
          )}

          {/* Message text - don't show if it's just the placeholder text */}
          {Boolean(message.text) && !isTranscriptionPlaceholder && (
            <Text className="text-typography-900">{message.text}</Text>
          )}

          {/* Timestamp */}
          <Text className="mt-1 text-xs text-typography-600">{formatTime(message.sentAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}
