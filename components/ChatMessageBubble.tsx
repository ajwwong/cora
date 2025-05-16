import { useMedplumProfile } from "@medplum/react-hooks";
// Keep using expo-av for now
import { useVideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import { CirclePlay, FileDown } from "lucide-react-native";
import { memo, useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Alert } from "react-native";

import { FullscreenImage } from "@/components/FullscreenImage";
import { LoadingButtonSpinner } from "@/components/LoadingButtonSpinner";
import { MinimalAudioPlayer } from "@/components/MinimalAudioPlayer";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ChatMessage } from "@/models/chat";
import type { AttachmentWithUrl } from "@/types/attachment";
import { isMediaExpired, mediaKey, shareFile } from "@/utils/media";

// AudioAttachmentProps removed as we now use MinimalAudioPlayer

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

// AudioAttachment function removed as we now use MinimalAudioPlayer

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
  // New props for timestamp context - feel2 style direct access
  allMessages,
  messageIndex,
  isInverted = false,
}: ChatMessageBubbleProps & {
  allMessages: ChatMessage[];
  messageIndex: number;
  isInverted?: boolean;
}) {
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
    ? "bg-[#f8e6df]" // Muted, lighter pink for patient messages
    : isAIMessage
      ? "bg-[#f0f0f0]" // Match bolt-expo AI bubble color
      : "bg-[#e8e0f0]"; // Muted, lighter purple for user messages
  const borderColor = isPatientMessage
    ? "border-[#edd6cc]" // Slightly darker border for patient messages
    : isAIMessage
      ? "border-[#e0e0e0]" // Lighter border for AI messages
      : "border-[#d9cce3]"; // Slightly darker border for user messages
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

  // Disabling timestamp calculation to improve performance
  const shouldShowTimestamp = false;
  const formattedTimestamp = null;

  return (
    <Pressable
      className={`relative w-full ${wrapperAlignment}`}
      onLongPress={handleLongPress}
      onPress={handlePress}
      delayLongPress={60000}
    >
      {/* Selection background */}
      {selected && <View className="absolute inset-0 bg-background-100" />}

      <View className={`max-w-[80%] ${wrapperAlignment} p-2`}>
        {/* Timestamp display - disabled for performance */}

        <View
          style={{
            width: "100%",
            borderRadius: 20,
            borderTopLeftRadius: isCurrentUser ? 20 : 4,
            borderTopRightRadius: isCurrentUser ? 4 : 20,
            padding: 12,
          }}
          className={`border ${bubbleColor} ${borderColor} ${
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

          {/* Status indicators */}
          {isTranscribing && (
            <View className="flex-row items-center gap-2">
              <LoadingButtonSpinner />
              <Text className="text-sm italic text-typography-500">Transcribing audio...</Text>
            </View>
          )}

          {/* Message text - don't show if it's just the placeholder text */}
          {Boolean(message.text) && !isTranscriptionPlaceholder && (
            <Text
              style={{
                maxWidth: "100%",
                flexShrink: 1,
                fontFamily: "Nunito-Regular",
                fontSize: 16,
                lineHeight: Platform.OS === "web" ? 1.5 : 24, // Adjusted for web platforms
                color: "#333", // Dark text for all messages for better readability
                ...(Platform.OS === "web" && {
                  // Web-specific styles to fix line spacing
                  whiteSpace: "pre-line",
                  display: "inline-block",
                }),
              }}
              className="max-w-full"
            >
              {message.text}
            </Text>
          )}

          {/* Audio attachment - back to its original position in bottom line */}
          {hasAudio && (
            <View className="mt-2">
              <MinimalAudioPlayer
                audioData={message.audioData!}
                messageId={message.id} // Add message ID
                threadId={message.originalCommunication.partOf?.[0]?.reference?.split("/")[1] || ""} // Add thread ID
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
                onRegenerateStart={() => {
                  // Optional: Could add visual indication that regeneration started
                }}
                onRegenerateComplete={() => {
                  // Optional: Could add visual indication that regeneration completed
                }}
              />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
