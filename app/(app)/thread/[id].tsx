import { useMedplumContext } from "@medplum/react-hooks";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useContextSelector } from "use-context-selector";

import { ChatHeader } from "@/components/ChatHeader";
import { ChatMessageInput } from "@/components/ChatMessageInput";
import { ChatMessageList } from "@/components/ChatMessageList";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MessageDeleteModal } from "@/components/MessageDeleteModal";
import { useVoiceMessageGate, VoiceMessageGate } from "@/components/VoiceMessageGate";
import { ChatContext } from "@/contexts/ChatContext";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useAvatars } from "@/hooks/useAvatars";
import { useSingleThread } from "@/hooks/useSingleThread";

async function getAttachment() {
  try {
    // Request permissions if needed
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please grant media library access to attach images and videos.",
      );
      return null;
    }

    // Pick media
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos", "livePhotos"],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      return result.assets[0];
    }
    return null;
  } catch (error) {
    Alert.alert("Error", "Failed to attach media. Please try again.");
    console.error("Error getting attachment:", error);
    return null;
  }
}

export default function ThreadPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useMedplumContext();
  const { thread, isLoadingThreads, isLoading, sendMessage, markMessageAsRead, deleteMessages } =
    useSingleThread({
      threadId: id,
    });
  const avatarRef = thread?.getAvatarRef({ profile });
  const { getAvatarURL, isLoading: isAvatarsLoading } = useAvatars(
    avatarRef?.reference ? [avatarRef] : [],
  );
  const [message, setMessage] = useState("");
  const [isAttaching, setIsAttaching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showVoiceGate, setShowVoiceGate] = useState(false);
  const { isRecording, recordingDuration, startRecording, stopRecording } = useAudioRecording();
  // Audio playback state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);
  const [autoplayedMessageIds, setAutoplayedMessageIds] = useState<Set<string>>(new Set());

  // Voice message tracking with FHIR extensions
  const {
    checkRecordingPermission,
    incrementVoiceCount,
    showLimitReachedAlert,
    remainingFreeMessages,
    hasPremium,
  } = useVoiceMessageGate(id);
  // Get medplum client (used in SubscriptionContext)
  const { medplum: _medplum } = useMedplumContext();

  // Get the bot processing state and setter from context
  const isBotProcessingMap = useContextSelector(ChatContext, (ctx) => ctx.isBotProcessingMap);
  const _processWithReflectionGuide = useContextSelector(
    ChatContext,
    (ctx) => ctx.processWithReflectionGuide,
  );

  // Track the most recent audio message
  const mostRecentAudioMessageId = useMemo(() => {
    // Sort messages by sentAt date (descending) and find the first with audio
    const sortedMessages = [...(thread?.messages || [])].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    );
    const mostRecent = sortedMessages.find((msg) => !!msg.audioData);

    if (mostRecent) {
      console.log(`Most recent audio message ID: ${mostRecent.id}, sent at: ${mostRecent.sentAt}`);
      return mostRecent.id;
    }
    return null;
  }, [thread?.messages]);
  // The chatContext is not needed since we get the sendMessage function directly from useSingleThread

  // If thread is not loading and the thread undefined, redirect to the index page
  useEffect(() => {
    if (!isLoadingThreads && !isLoading && !thread) {
      router.replace("/");
    }
  }, [isLoadingThreads, isLoading, thread]);

  // Mark all unread messages as read when the thread is loaded
  useEffect(() => {
    if (!thread) return;
    thread.messages.forEach((message) => {
      if (!message.read) {
        markMessageAsRead({ threadId: thread.id, messageId: message.id });
      }
    });
  }, [thread, markMessageAsRead]);

  // Audio control handlers
  const handleAudioPlay = useCallback((messageId: string) => {
    // Update global audio state
    setIsAudioPlaying(true);
    setCurrentPlayingMessageId(messageId);

    // If any other audio is playing, it will stop itself when it sees
    // that it's no longer the current playing message
  }, []);

  const handleAudioStop = useCallback(
    (messageId: string) => {
      // Only update global state if this is the current playing message
      if (currentPlayingMessageId === messageId) {
        setIsAudioPlaying(false);
        setCurrentPlayingMessageId(null);
      }
    },
    [currentPlayingMessageId],
  );

  // Mark a message as autoplayed
  const markMessageAsAutoplayed = useCallback((messageId: string) => {
    console.log(`Thread: marking message as autoplayed: ${messageId}`);
    setAutoplayedMessageIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(messageId);
      console.log(`Thread: autoplayed messages count: ${newSet.size}`);
      return newSet;
    });
  }, []);

  const handleSendMessage = useCallback(
    async (attachment?: ImagePicker.ImagePickerAsset, audioData?: string) => {
      if (!thread) return;
      setIsSending(true);
      const existingMessage = message;
      setMessage("");

      try {
        if (audioData) {
          // For audio messages, we want to use a different flow based on SecureHealth implementation
          console.log("Audio data detected, using transcription flow");

          // 1. Create a placeholder message for transcription
          console.log("Creating transcription placeholder message");
          const placeholderId = await sendMessage({
            threadId: thread.id,
            message: "[Audio message - Transcribing...]",
            skipAIProcessing: true, // Don't process this placeholder with AI
          });

          // 2. Send the audio for transcription and processing
          console.log("Sending audio data for transcription and processing");
          await sendMessage({
            threadId: thread.id,
            audioData,
            placeholderMessageId: placeholderId,
            // Process with AI if this is a reflection thread
            processWithAI: thread.isReflectionThread,
          });
        } else {
          // For text messages, use the standard flow
          await sendMessage({
            threadId: thread.id,
            message: existingMessage,
            attachment,
            // Process with AI if this is a reflection thread
            processWithAI: thread.isReflectionThread,
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setMessage(existingMessage);
        Alert.alert("Error", "Failed to send message. Please try again.");
      } finally {
        setIsSending(false);
      }
    },
    [thread, message, sendMessage],
  );

  const handleAttachment = useCallback(async () => {
    if (!thread) return;

    console.log("Attachment button clicked, isRecording:", isRecording);

    // If already recording, stop recording and send audio
    if (isRecording) {
      console.log("Attempting to stop recording and process audio");
      setIsAttaching(true);
      try {
        // First stop the recording to get the blob
        const blob = await stopRecording();
        console.log("Recording stopped successfully, blob size:", blob.size);

        // We don't need to call handleSendMessage directly here anymore
        // as we've implemented the SecureHealth style audio handling workflow
        try {
          // Convert blob to base64
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              try {
                // Extract the base64 data (remove the data URL prefix)
                const result = reader.result as string;
                const base64 = result.split(",")[1];
                console.log("Base64 data extracted, length:", base64.length);
                resolve(base64);
              } catch (err) {
                console.error("Error extracting base64 data:", err);
                reject(err);
              }
            };

            reader.onerror = () => {
              console.error("FileReader error occurred");
              reject(new Error("FileReader error"));
            };

            // Start reading the blob
            reader.readAsDataURL(blob);
          });

          // handleSendMessage will automatically handle the audio transcription workflow
          // using the two-step process from SecureHealth
          console.log("Sending audio for processing...");
          await handleSendMessage(undefined, base64Data);
          console.log("Audio processing initiated successfully");

          // Increment voice message count after sending audio message
          console.log("📱 [handleAttachment] Incrementing voice message count after sending audio");
          await incrementVoiceCount();

          // Log the update
          console.log(`📱 [handleAttachment] Voice message count incremented successfully`);
        } catch (error) {
          console.error("Error processing audio data:", error);
          Alert.alert("Error", "Failed to process the recording. Please try again.");
        }
      } catch (error) {
        console.error("Error stopping recording:", error);
        Alert.alert("Error", "Failed to stop the recording. Please try again.");
      } finally {
        setIsAttaching(false);
      }
    } else {
      // If reflection thread, start recording (with subscription check)
      if (thread.isReflectionThread) {
        // Check if user can record voice messages based on subscription status
        const canRecord = await checkRecordingPermission();

        if (canRecord) {
          try {
            console.log("Attempting to start recording (reflection thread)");
            await startRecording();
            console.log("Recording started successfully");
          } catch (error) {
            console.error("Error starting recording:", error);
            Alert.alert("Error", "Failed to start recording. Please check microphone permissions.");
          }
        } else {
          // User has reached daily limit, show upgrade prompt with direct paywall
          console.log("📱 [handleAttachment] Daily limit reached, showing VoiceMessageGate modal");
          setShowVoiceGate(true);
        }
      } else {
        // Regular attachment flow
        console.log("Regular attachment flow (not a reflection thread)");
        setIsAttaching(true);
        try {
          const attachment = await getAttachment();
          if (attachment) {
            await handleSendMessage(attachment);
          }
        } catch (error) {
          console.error("Error with attachment:", error);
          Alert.alert("Error", "Failed to process attachment. Please try again.");
        } finally {
          setIsAttaching(false);
        }
      }
    }
  }, [
    thread,
    handleSendMessage,
    isRecording,
    startRecording,
    stopRecording,
    checkRecordingPermission,
    showLimitReachedAlert,
    hasPremium,
    remainingFreeMessages,
    incrementVoiceCount,
  ]);

  const handleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // VoiceMessageGate callback handlers
  const handleAllowRecording = useCallback(() => {
    console.log("📱 [VoiceMessageGate] Recording allowed, returning to chat screen");
    // Just close the modal and return to normal chat - user can press mic button again
    setShowVoiceGate(false);
  }, []);

  const handleDenyRecording = useCallback(() => {
    console.log("📱 [VoiceMessageGate] Recording denied");
    // Already handled by modal state, no additional action needed
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!thread) return;
    setIsDeleting(true);
    try {
      await deleteMessages({
        threadId: thread.id,
        messageIds: Array.from(selectedMessages),
      });
      setSelectedMessages(new Set());
    } catch (error) {
      console.error("Error deleting messages:", error);
      Alert.alert("Error", "Failed to delete messages. Please try again.");
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  }, [thread, selectedMessages, deleteMessages]);

  const handleDeleteMessages = useCallback(() => {
    if (!thread || selectedMessages.size === 0) return;
    setIsDeleteModalOpen(true);
  }, [thread, selectedMessages]);

  const handleCancelSelection = useCallback(() => {
    setSelectedMessages(new Set());
  }, []);

  if (!thread || isAvatarsLoading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      className="bg-background-50"
      contentContainerStyle={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bottomOffset={80}
    >
      <ChatHeader
        currentThread={thread}
        getAvatarURL={getAvatarURL}
        selectedCount={selectedMessages.size}
        onDelete={handleDeleteMessages}
        onCancelSelection={handleCancelSelection}
        isDeleting={isDeleting}
        remainingFreeMessages={remainingFreeMessages}
        hasPremium={hasPremium}
      />
      <ChatMessageList
        messages={thread.messages}
        loading={isSending || isLoading}
        selectedMessages={selectedMessages}
        onMessageSelect={handleMessageSelect}
        selectionEnabled={selectedMessages.size > 0}
        // Audio control props
        isAudioPlaying={isAudioPlaying}
        currentPlayingMessageId={currentPlayingMessageId}
        autoplayedMessageIds={autoplayedMessageIds}
        mostRecentAudioMessageId={mostRecentAudioMessageId}
        onAudioPlay={handleAudioPlay}
        onAudioStop={handleAudioStop}
        markMessageAsAutoplayed={markMessageAsAutoplayed}
      />
      <ChatMessageInput
        message={message}
        setMessage={setMessage}
        onAttachment={handleAttachment}
        onSend={handleSendMessage}
        isSending={isSending || isAttaching}
        disabled={selectedMessages.size > 0}
        isRecording={isRecording}
        isReflectionThread={thread.isReflectionThread}
        recordingDuration={recordingDuration}
        isBotProcessing={isBotProcessingMap.get(thread.id) || false}
        remainingFreeMessages={remainingFreeMessages}
        hasPremium={hasPremium}
      />
      <MessageDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        selectedCount={selectedMessages.size}
        isDeleting={isDeleting}
      />
      <VoiceMessageGate
        threadId={id}
        onAllowRecording={handleAllowRecording}
        onDenyRecording={handleDenyRecording}
        isOpen={showVoiceGate}
        onClose={() => setShowVoiceGate(false)}
      />
    </KeyboardAwareScrollView>
  );
}
