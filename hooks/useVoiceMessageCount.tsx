import { Communication } from "@medplum/fhirtypes";
import { useMedplum } from "@medplum/react-hooks";
import { endOfDay, startOfDay } from "date-fns";
import { useEffect, useState } from "react";

/**
 * Hook to count the number of voice messages sent today
 * Used for implementing free tier limitations (10 voice messages per day)
 *
 * @param threadId Optional thread ID to filter messages by thread
 * @returns Object with voice message count data and functions
 */
export function useVoiceMessageCount(threadId?: string) {
  const [todayVoiceCount, setTodayVoiceCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const medplum = useMedplum();

  // Maximum number of free voice messages per day
  const FREE_DAILY_LIMIT = 10;

  useEffect(() => {
    const fetchTodayVoiceMessages = async () => {
      try {
        console.log("📱 [useVoiceMessageCount] Starting voice message count fetch");
        setIsLoading(true);

        // Get today's date range in ISO format
        const today = new Date();
        const todayStart = startOfDay(today).toISOString();
        const todayEnd = endOfDay(today).toISOString();
        console.log(`📱 [useVoiceMessageCount] Date range: ${todayStart} to ${todayEnd}`);

        // Build search query for messages with voice attachments
        // Try a less restrictive search - remove date filters to find ANY messages
        const query: Record<string, string> = {
          _count: "100", // Higher limit to catch more messages
          _sort: "-sent", // Newest first
        };

        // If a specific thread ID is provided, filter by that thread
        if (threadId) {
          query["part-of"] = threadId;
          console.log(`📱 [useVoiceMessageCount] Filtering by thread: ${threadId}`);
        }

        // Include only messages from the patient (not the reflection guide)
        const profile = medplum.getProfile();
        if (profile?.id) {
          query["sender"] = profile.id;
          console.log(`📱 [useVoiceMessageCount] Filtering by sender: ${profile.id}`);
        }

        console.log("📱 [useVoiceMessageCount] Query:", JSON.stringify(query));

        // Execute the search
        const messages = await medplum.search("Communication", query);
        console.log(
          `📱 [useVoiceMessageCount] Search returned ${messages.entry?.length || 0} results`,
        );

        // Log the first few messages to examine their structure
        if (messages.entry && messages.entry.length > 0) {
          console.log(`📱 [useVoiceMessageCount] Examining first message structure:`);
          const firstMessage = messages.entry[0].resource as Communication;
          console.log(`📱 [useVoiceMessageCount] Message ID: ${firstMessage.id}`);
          console.log(`📱 [useVoiceMessageCount] Has payload? ${!!firstMessage.payload}`);
          console.log(
            `📱 [useVoiceMessageCount] Payload length: ${firstMessage.payload?.length || 0}`,
          );
          console.log(`📱 [useVoiceMessageCount] Has extensions? ${!!firstMessage.extension}`);

          // Look for any audio-related fields in the message
          const allKeys = JSON.stringify(Object.keys(firstMessage));
          console.log(`📱 [useVoiceMessageCount] Message keys: ${allKeys}`);

          // Check if there's a special content structure
          if (firstMessage.payload) {
            firstMessage.payload.forEach((item, index) => {
              console.log(
                `📱 [useVoiceMessageCount] Payload item ${index}: ${JSON.stringify(Object.keys(item))}`,
              );
              if (item.contentAttachment) {
                console.log(
                  `📱 [useVoiceMessageCount] Attachment content type: ${item.contentAttachment.contentType}`,
                );
              }
            });
          }
        } else {
          console.log(`📱 [useVoiceMessageCount] No messages found to analyze`);
        }

        // Count only voice messages (checking for audio content type in attachments or audio extension)
        const voiceMessageCount =
          messages.entry?.reduce((count, entry) => {
            const message = entry.resource as Communication;

            // Check for audio attachment
            const hasVoiceAttachment = message.payload?.some((payload) =>
              payload.contentAttachment?.contentType?.startsWith("audio/"),
            );

            // Check for audio extension (used in our app for voice messages)
            const hasAudioExtension = message.extension?.some(
              (ext) =>
                ext.url ===
                "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data",
            );

            // Additional check for any "audio" related text in stringified message (broader check)
            const messageStr = JSON.stringify(message).toLowerCase();
            const hasAudioKeyword = messageStr.includes("audio");

            // Check message content for indicators of an audio message
            const hasAudioMessageIndicator = message.payload?.some(
              (payload) =>
                payload.contentString?.includes("Audio message") ||
                payload.contentString?.includes("Transcribing audio") ||
                payload.contentString?.includes("[Audio message]"),
            );

            const isVoiceMessage =
              hasVoiceAttachment ||
              hasAudioExtension ||
              hasAudioKeyword ||
              hasAudioMessageIndicator;

            if (isVoiceMessage) {
              console.log(
                `📱 [useVoiceMessageCount] Found voice message: ${message.id} (${
                  hasVoiceAttachment
                    ? "attachment"
                    : hasAudioExtension
                      ? "extension"
                      : hasAudioMessageIndicator
                        ? "content text"
                        : "keyword match"
                })`,
              );
            }

            return isVoiceMessage ? count + 1 : count;
          }, 0) || 0;

        console.log(`📱 [useVoiceMessageCount] Total voice message count: ${voiceMessageCount}`);
        setTodayVoiceCount(voiceMessageCount);
      } catch (error) {
        console.error("Error counting voice messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodayVoiceMessages();

    // Set up a refresh interval (every 2 minutes)
    const refreshInterval = setInterval(fetchTodayVoiceMessages, 2 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [medplum, threadId]);

  // Function to force a refresh of the count
  const refreshCount = async () => {
    console.log("📱 [useVoiceMessageCount] MANUAL REFRESH triggered");
    setIsLoading(true);
    try {
      // Get today's date range in ISO format
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      console.log(
        `📱 [useVoiceMessageCount] MANUAL REFRESH - Date range: ${todayStart} to ${todayEnd}`,
      );

      // Try a less restrictive search - remove date filters, just focus on the thread
      const query: Record<string, string> = {
        _count: "100", // Higher limit to catch more messages
        _sort: "-sent",
      };

      if (threadId) {
        query["part-of"] = threadId;
        console.log(`📱 [useVoiceMessageCount] MANUAL REFRESH - Filtering by thread: ${threadId}`);
      }

      const profile = medplum.getProfile();
      if (profile?.id) {
        query["sender"] = profile.id;
        console.log(
          `📱 [useVoiceMessageCount] MANUAL REFRESH - Filtering by sender: ${profile.id}`,
        );
      }

      console.log("📱 [useVoiceMessageCount] MANUAL REFRESH - Query:", JSON.stringify(query));

      const messages = await medplum.search("Communication", query);
      console.log(
        `📱 [useVoiceMessageCount] MANUAL REFRESH - Search returned ${messages.entry?.length || 0} results`,
      );

      // Log detailed information about the first few messages
      if (messages.entry && messages.entry.length > 0) {
        console.log(
          `📱 [useVoiceMessageCount] MANUAL REFRESH - Examining first message structure:`,
        );
        const firstMessage = messages.entry[0].resource as Communication;
        console.log(`📱 [useVoiceMessageCount] MANUAL REFRESH - Message ID: ${firstMessage.id}`);
        console.log(
          `📱 [useVoiceMessageCount] MANUAL REFRESH - Message type: ${firstMessage.resourceType}`,
        );
        console.log(
          `📱 [useVoiceMessageCount] MANUAL REFRESH - Message content: ${JSON.stringify(firstMessage.payload?.[0]?.contentString).substring(0, 100)}...`,
        );

        // Stringify entire message to see what we've got
        console.log(
          `📱 [useVoiceMessageCount] MANUAL REFRESH - Full message (truncated): ${JSON.stringify(firstMessage).substring(0, 200)}...`,
        );
      } else {
        console.log(`📱 [useVoiceMessageCount] MANUAL REFRESH - No messages found to analyze`);
      }

      const voiceMessageCount =
        messages.entry?.reduce((count, entry) => {
          const message = entry.resource as Communication;

          // Check for audio attachment
          const hasVoiceAttachment = message.payload?.some((payload) =>
            payload.contentAttachment?.contentType?.startsWith("audio/"),
          );

          // Check for audio extension (used in our app for voice messages)
          const hasAudioExtension = message.extension?.some(
            (ext) =>
              ext.url ===
              "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data",
          );

          // Additional check for any "audio" related text in stringified message (broader check)
          const messageStr = JSON.stringify(message).toLowerCase();
          const hasAudioKeyword = messageStr.includes("audio");

          // Check message content for indicators of an audio message
          const hasAudioMessageIndicator = message.payload?.some(
            (payload) =>
              payload.contentString?.includes("Audio message") ||
              payload.contentString?.includes("Transcribing audio") ||
              payload.contentString?.includes("[Audio message]"),
          );

          const isVoiceMessage =
            hasVoiceAttachment || hasAudioExtension || hasAudioKeyword || hasAudioMessageIndicator;

          if (isVoiceMessage) {
            console.log(
              `📱 [useVoiceMessageCount] MANUAL REFRESH - Found voice message: ${message.id} (${
                hasVoiceAttachment
                  ? "attachment"
                  : hasAudioExtension
                    ? "extension"
                    : hasAudioMessageIndicator
                      ? "content text"
                      : "keyword match"
              })`,
            );
          }

          return isVoiceMessage ? count + 1 : count;
        }, 0) || 0;

      console.log(
        `📱 [useVoiceMessageCount] MANUAL REFRESH - Total voice message count: ${voiceMessageCount}, previous count: ${todayVoiceCount}`,
      );
      setTodayVoiceCount(voiceMessageCount);
      return voiceMessageCount;
    } catch (error) {
      console.error("Error refreshing voice message count:", error);
      return todayVoiceCount;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    voiceCount: todayVoiceCount,
    isLoading,
    refreshCount,
    remainingFreeMessages: Math.max(0, FREE_DAILY_LIMIT - todayVoiceCount),
    hasReachedDailyLimit: todayVoiceCount >= FREE_DAILY_LIMIT,
  };
}
