import { useCallback } from "react";
import { FlatList, ListRenderItem } from "react-native";

import { useAvatars } from "@/hooks/useAvatars";
import type { ChatMessage } from "@/models/chat";

import { ChatMessageBubble } from "./ChatMessageBubble";
import { LoadingDots } from "./LoadingDots";

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  selectedMessages?: Set<string>;
  onMessageSelect?: (messageId: string) => void;
  selectionEnabled?: boolean;
  // Audio control props
  isAudioPlaying?: boolean;
  currentPlayingMessageId?: string | null;
  autoplayedMessageIds?: Set<string>;
  mostRecentAudioMessageId?: string | null;
  onAudioPlay?: (messageId: string) => void;
  onAudioStop?: (messageId: string) => void;
  markMessageAsAutoplayed?: (messageId: string) => void;
}

export function ChatMessageList({
  messages,
  loading,
  selectedMessages = new Set(),
  onMessageSelect,
  selectionEnabled = false,
  // Audio control props
  isAudioPlaying,
  currentPlayingMessageId,
  autoplayedMessageIds = new Set(),
  mostRecentAudioMessageId,
  onAudioPlay,
  onAudioStop,
  markMessageAsAutoplayed,
}: ChatMessageListProps) {
  const { getAvatarURL } = useAvatars(messages.map((message) => message.avatarRef));

  const renderItem: ListRenderItem<ChatMessage> = useCallback(
    ({ item: message, index }) => {
      // Pass the entire messages array and current index to let the component handle its own logic
      return (
        <ChatMessageBubble
          message={message}
          avatarURL={getAvatarURL(message.avatarRef)}
          selected={selectedMessages.has(message.id)}
          onSelect={onMessageSelect}
          selectionEnabled={selectionEnabled}
          // Audio control props
          isAudioPlaying={isAudioPlaying}
          isCurrentPlayingMessage={currentPlayingMessageId === message.id}
          isAutoplayed={autoplayedMessageIds.has(message.id)}
          isMostRecentAudioMessage={message.id === mostRecentAudioMessageId}
          onAudioPlay={() => {
            console.log(`Audio play triggered for message: ${message.id}`);
            onAudioPlay?.(message.id);
          }}
          onAudioStop={() => {
            console.log(`Audio stop triggered for message: ${message.id}`);
            onAudioStop?.(message.id);
          }}
          markAsAutoplayed={() => {
            console.log(`Marking message as autoplayed: ${message.id}`);
            markMessageAsAutoplayed?.(message.id);
          }}
          // Timestamp context - pass the entire messages array and index
          allMessages={messages}
          messageIndex={index}
          isInverted={true} // Indicate that this is an inverted FlatList
        />
      );
    },
    [
      getAvatarURL,
      selectedMessages,
      onMessageSelect,
      selectionEnabled,
      isAudioPlaying,
      currentPlayingMessageId,
      autoplayedMessageIds,
      mostRecentAudioMessageId,
      onAudioPlay,
      onAudioStop,
      markMessageAsAutoplayed,
    ],
  );

  return (
    <FlatList
      style={{
        flex: 1,
        backgroundColor: "#f8f8fc", // Light purplish background
      }}
      data={[...messages].reverse()}
      renderItem={renderItem}
      keyExtractor={(message) => message.id}
      showsVerticalScrollIndicator={true}
      initialNumToRender={15}
      windowSize={5}
      removeClippedSubviews
      inverted
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      ListHeaderComponent={loading ? <LoadingDots /> : null}
    />
  );
}
