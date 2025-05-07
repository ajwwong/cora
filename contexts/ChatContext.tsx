import {
  createReference,
  getReferenceString,
  MedplumClient,
  ProfileResource,
  QueryTypes,
} from "@medplum/core";
import {
  Attachment,
  Bundle,
  Communication,
  CommunicationPayload,
  Extension,
  Patient,
  Reference,
} from "@medplum/fhirtypes";
import { useMedplumContext, useSubscription } from "@medplum/react-hooks";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createContext } from "use-context-selector";

import { Thread } from "@/models/chat";
import { syncResourceArray } from "@/utils/array";
import { getQueryString } from "@/utils/url";

async function fetchThreads({
  medplum,
  threadsQuery,
}: {
  medplum: MedplumClient;
  threadsQuery: QueryTypes;
}): Promise<{ threads: Communication[]; threadCommMap: Map<string, Communication[]> }> {
  const searchResults = await medplum.search("Communication", threadsQuery, {
    cache: "no-cache",
  });
  const threads =
    searchResults.entry?.filter((e) => e.search?.mode === "match").map((e) => e.resource!) || [];

  // Create a map of thread ID to messages
  const threadCommMap = new Map<string, Communication[]>();
  threads.forEach((thread) => {
    const messages = searchResults.entry
      ?.filter(
        (e) =>
          e.search?.mode === "include" &&
          e.resource?.partOf?.[0]?.reference === `Communication/${thread.id}`,
      )
      .map((e) => e.resource!);
    threadCommMap.set(thread.id!, messages || []);
  });

  return { threads, threadCommMap };
}

async function updateUnreceivedCommunications({
  medplum,
  communications,
}: {
  medplum: MedplumClient;
  communications: Communication[];
}): Promise<Communication[]> {
  const profile = medplum.getProfile();
  const newComms = communications.filter((comm) => !comm.received);
  if (newComms.length === 0) return communications;

  const now = new Date().toISOString();
  const updatedComms = await Promise.all(
    newComms.map((comm) => {
      const isIncoming =
        comm.sender && profile && getReferenceString(comm.sender) !== getReferenceString(profile);
      if (isIncoming) {
        return medplum.patchResource("Communication", comm.id!, [
          { op: "add", path: "/received", value: now },
        ]);
      }
      return comm;
    }),
  );
  return communications.map(
    (comm) => updatedComms.find((updated) => updated.id === comm.id) || comm,
  );
}

async function fetchThreadCommunications({
  medplum,
  threadId,
}: {
  medplum: MedplumClient;
  threadId: string;
}): Promise<Communication[]> {
  return await medplum.searchResources(
    "Communication",
    {
      "part-of": `Communication/${threadId}`,
      _sort: "-sent",
    },
    {
      cache: "no-cache",
    },
  );
}

async function createThreadComm({
  medplum,
  profile,
  topic,
  options,
}: {
  medplum: MedplumClient;
  profile: Patient;
  topic: string;
  options?: {
    isReflectionThread?: boolean;
    reflectionTheme?: string;
  };
}): Promise<Communication> {
  const sent = new Date().toISOString();

  // Create extensions array with last changed date
  const extensions: Extension[] = [
    {
      url: "https://medplum.com/last-changed",
      valueDateTime: sent,
    },
  ];

  // Add reflection guide extensions if specified
  if (options?.isReflectionThread) {
    extensions.push({
      url: "https://progressnotes.app/fhir/StructureDefinition/reflection-thread",
      valueBoolean: true,
    });

    if (options.reflectionTheme) {
      extensions.push({
        url: "https://progressnotes.app/fhir/StructureDefinition/reflection-themes",
        valueString: options.reflectionTheme,
      });
    }
  }

  return await medplum.createResource({
    resourceType: "Communication",
    status: "completed",
    sent,
    sender: {
      reference: getReferenceString(profile),
      display: `${profile.name?.[0]?.given?.[0]} ${profile.name?.[0]?.family}`.trim(),
    },
    subject: createReference(profile),
    payload: [{ contentString: topic.trim() }],
    extension: extensions,
  } satisfies Communication);
}

async function touchThreadLastChanged({
  medplum,
  threadId,
  value,
}: {
  medplum: MedplumClient;
  threadId: string;
  value: string;
}): Promise<void> {
  await medplum.patchResource("Communication", threadId, [
    {
      op: "add",
      path: "/extension/0/valueDateTime",
      value,
    },
  ]);
}

async function createThreadMessageComm({
  medplum,
  profile,
  patientRef,
  message,
  threadId,
  attachment,
  audioData,
  audioContentType = "audio/mp3",
}: {
  medplum: MedplumClient;
  profile: ProfileResource;
  patientRef: Reference<Patient>;
  message: string;
  threadId: string;
  attachment?: Attachment;
  audioData?: string;
  audioContentType?: string;
}): Promise<Communication> {
  const payload: CommunicationPayload[] = [];
  const extensions: Extension[] = [];

  // Add text message if provided
  if (message.trim()) {
    payload.push({ contentString: message.trim() });
  }

  // Add attachment if provided
  if (attachment) {
    payload.push({
      contentAttachment: attachment,
    });
  }

  // Add audio data extensions if provided
  if (audioData) {
    extensions.push({
      url: "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data",
      valueString: audioData,
    });

    extensions.push({
      url: "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-content-type",
      valueString: audioContentType,
    });
  }

  return await medplum.createResource({
    resourceType: "Communication",
    status: "in-progress",
    sent: new Date().toISOString(),
    sender: createReference(profile),
    subject: patientRef,
    payload,
    partOf: [{ reference: `Communication/${threadId}` }],
    extension: extensions.length > 0 ? extensions : undefined,
  } satisfies Communication);
}

interface ChatContextType {
  threads: Thread[];
  isLoadingThreads: boolean;
  isLoadingMessagesMap: Map<string, boolean>;
  isBotProcessingMap: Map<string, boolean>;
  connectedOnce: boolean;
  reconnecting: boolean;
  createThread: (
    topic: string,
    options?: {
      isReflectionThread?: boolean;
      reflectionTheme?: string;
    },
  ) => Promise<string | undefined>;
  receiveThread: (threadId: string) => Promise<void>;
  sendMessage: ({
    threadId,
    message,
    attachment,
    audioData,
    processWithAI,
  }: {
    threadId: string;
    message?: string;
    attachment?: ImagePicker.ImagePickerAsset;
    audioData?: string;
    processWithAI?: boolean;
  }) => Promise<string | undefined>;
  markMessageAsRead: ({
    threadId,
    messageId,
  }: {
    threadId: string;
    messageId: string;
  }) => Promise<void>;
  deleteMessages: ({
    threadId,
    messageIds,
  }: {
    threadId: string;
    messageIds: string[];
  }) => Promise<void>;
  processWithReflectionGuide: ({
    threadId,
    messageId,
    textInput,
    audioData,
  }: {
    threadId: string;
    messageId?: string;
    textInput?: string;
    audioData?: string;
  }) => Promise<void>;
}

export const ChatContext = createContext<ChatContextType>({
  threads: [],
  isLoadingThreads: true,
  isLoadingMessagesMap: new Map(),
  isBotProcessingMap: new Map(),
  connectedOnce: false,
  reconnecting: false,
  createThread: async () => undefined,
  receiveThread: async () => {},
  sendMessage: async () => undefined,
  markMessageAsRead: async () => {},
  deleteMessages: async () => {},
  processWithReflectionGuide: async () => {},
});

interface ChatProviderProps {
  children: React.ReactNode;
  onWebSocketClose?: () => void;
  onWebSocketOpen?: () => void;
  onSubscriptionConnect?: () => void;
  onError?: (error: Error) => void;
}

export function ChatProvider({
  children,
  onWebSocketClose,
  onWebSocketOpen,
  onSubscriptionConnect,
  onError,
}: ChatProviderProps) {
  const { medplum } = useMedplumContext();
  const [profile, setProfile] = useState(medplum.getProfile());
  const [threads, setThreads] = useState<Communication[]>([]);
  const [threadCommMap, setThreadCommMap] = useState<Map<string, Communication[]>>(new Map());
  const [reconnecting, setReconnecting] = useState(false);
  const [connectedOnce, setConnectedOnce] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessagesMap, setIsLoadingMessagesMap] = useState<Map<string, boolean>>(new Map());
  const [isBotProcessingMap, setIsBotProcessingMap] = useState<Map<string, boolean>>(new Map());

  // Threads memoized, sorted by threadOrder
  const threadsOut = useMemo(() => {
    if (!profile) return [];
    return threads
      .map((thread) =>
        Thread.fromCommunication({
          comm: thread,
          threadMessageComms: threadCommMap.get(thread.id!) || [],
        }),
      )
      .sort((a, b) => b.threadOrder - a.threadOrder);
  }, [profile, threads, threadCommMap]);

  // Query setup for subscription
  const subscriptionQuery = useMemo(
    () => ({
      "part-of:missing": true,
      subject: profile?.resourceType === "Patient" ? getReferenceString(profile) : undefined,
    }),
    [profile],
  );

  // Query for fetching threads (including messages)
  const threadsQuery = useMemo(
    () => ({
      ...subscriptionQuery,
      _revinclude: "Communication:part-of",
      _sort: "-sent",
    }),
    [subscriptionQuery],
  );

  // Function to fetch threads with error handling
  const refreshThreads = useCallback(async () => {
    if (!profile) return;

    try {
      setIsLoadingThreads(true);
      const { threads, threadCommMap } = await fetchThreads({ medplum, threadsQuery });
      setThreads(threads);
      setThreadCommMap(threadCommMap);
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [medplum, profile, threadsQuery, onError]);

  // Fetch communications for current thread and update received timestamp
  const receiveThread = useCallback(
    async (threadId: string) => {
      try {
        setIsLoadingMessagesMap((prev) => {
          return new Map([...prev, [threadId, true]]);
        });
        let threadComms = await fetchThreadCommunications({ medplum, threadId: threadId });
        threadComms = await updateUnreceivedCommunications({
          medplum,
          communications: threadComms,
        });
        setThreadCommMap((prev) => {
          return new Map([...prev, [threadId, threadComms]]);
        });
      } catch (err) {
        onError?.(err as Error);
      } finally {
        setIsLoadingMessagesMap((prev) => {
          return new Map([...prev, [threadId, false]]);
        });
      }
    },
    [medplum, onError],
  );

  // Subscribe to communication changes
  useSubscription(
    `Communication?${getQueryString(subscriptionQuery)}`,
    useCallback(
      async (bundle: Bundle) => {
        const communication = bundle.entry?.[1]?.resource as Communication;
        if (!communication) return;

        // Sync the thread
        setThreads((prev) => syncResourceArray(prev, communication));
        // Sync the thread messages
        receiveThread(communication.id!);
      },
      [receiveThread],
    ),
    {
      onWebSocketClose: useCallback(() => {
        if (!reconnecting) {
          setReconnecting(true);
        }
        onWebSocketClose?.();
      }, [reconnecting, onWebSocketClose]),
      onWebSocketOpen: useCallback(() => {
        onWebSocketOpen?.();
      }, [onWebSocketOpen]),
      onSubscriptionConnect: useCallback(() => {
        if (!connectedOnce) {
          setConnectedOnce(true);
        }
        if (reconnecting) {
          refreshThreads();
          setReconnecting(false);
        }
        onSubscriptionConnect?.();
      }, [connectedOnce, reconnecting, onSubscriptionConnect, refreshThreads]),
      onError: useCallback((err: Error) => onError?.(err), [onError]),
    },
  );

  // Handle profile changes, clear state
  useEffect(() => {
    const latestProfile = medplum.getProfile();
    if (profile?.id !== latestProfile?.id) {
      setProfile(latestProfile);
      setThreads([]);
      setThreadCommMap(new Map());
      setReconnecting(false);
      setConnectedOnce(false);
      setIsLoadingThreads(true);
      setIsLoadingMessagesMap(new Map());
    }
  }, [medplum, profile]);

  // Load initial data
  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  // CRUD functions
  const createThread = useCallback(
    async (
      topic: string,
      options?: {
        isReflectionThread?: boolean;
        reflectionTheme?: string;
      },
    ) => {
      if (!topic.trim() || !profile) return;
      if (profile.resourceType !== "Patient") throw new Error("Only patients can create threads");

      const newThread = await createThreadComm({
        medplum,
        profile,
        topic,
        options,
      });

      setThreads((prev) => syncResourceArray(prev, newThread));
      setThreadCommMap((prev) => {
        return new Map([...prev, [newThread.id!, []]]);
      });

      // Add a welcome message from the reflection guide bot
      if (options?.isReflectionThread) {
        try {
          // Create a welcome message from the bot
          const welcomeMessage = await medplum.createResource({
            resourceType: "Communication",
            status: "completed",
            sent: new Date().toISOString(),
            subject: { reference: `Patient/${profile.id}` },
            sender: { reference: "Practitioner/reflection-guide-bot" },
            payload: [
              {
                contentString: `Welcome to your reflection session on "${topic}". I'm here to guide you on a thoughtful journey of self-discovery. Feel free to share your thoughts, ask questions, or explore ideas related to this topic. You can type your messages or tap the microphone button to speak. What's been on your mind about this lately?`,
              },
            ],
            partOf: [{ reference: `Communication/${newThread.id}` }],
          });

          // Update thread map with the welcome message
          setThreadCommMap((prev) => {
            const existing = prev.get(newThread.id!) || [];
            return new Map([...prev, [newThread.id!, [...existing, welcomeMessage]]]);
          });

          // Update the last activity timestamp on the thread
          await touchThreadLastChanged({
            medplum,
            threadId: newThread.id!,
            value: welcomeMessage.sent!,
          });
        } catch (error) {
          console.error("Error adding welcome message:", error);
          // Continue even if welcome message fails - user can still use the thread
        }
      }

      return newThread.id;
    },
    [medplum, profile],
  );

  const sendMessage = useCallback(
    async ({
      threadId,
      message,
      attachment,
      audioData,
      processWithAI = true,
      skipAIProcessing = false,
      placeholderMessageId,
    }: {
      threadId: string;
      message?: string;
      attachment?: ImagePicker.ImagePickerAsset;
      audioData?: string;
      processWithAI?: boolean;
      skipAIProcessing?: boolean; // Skip AI processing even if processWithAI=true (for placeholders)
      placeholderMessageId?: string; // For audio transcription flow
    }) => {
      if (!profile) return;
      if (!message?.trim() && !attachment && !audioData && !placeholderMessageId) return;

      try {
        let uploadedAttachment;
        if (attachment) {
          // Upload the file to Medplum
          const response = await fetch(attachment.uri);
          const blob = await response.blob();
          uploadedAttachment = await medplum.createAttachment({
            data: blob,
            filename: attachment.fileName ?? undefined,
            contentType: attachment.mimeType ?? "application/octet-stream",
          });
        }

        // Find the patient of the thread
        const thread = threads.find((t) => t.id === threadId);
        if (!thread) return;

        let newCommunication;

        // Handle special case for audio with placeholder
        if (audioData && placeholderMessageId) {
          console.log("Processing audio with placeholder ID:", placeholderMessageId);

          // First create a Binary resource (exactly like in SecureHealth)
          console.log("Creating Binary resource for audio data...");
          const binary = await medplum.createResource({
            resourceType: "Binary",
            contentType: "audio/mp3",
            data: audioData,
          });

          console.log("Binary resource created with ID:", binary.id);

          // Now process the audio via the reflection guide bot for transcription
          console.log(`STEP 1: Getting transcription from audio with binaryId: ${binary.id}`);
          const transcriptionResponse = await medplum.executeBot(
            {
              system: "https://progressnotes.app",
              value: "reflection-guide",
            },
            {
              patientId: profile.id,
              threadId: threadId,
              placeholderMessageId: placeholderMessageId,
              audioBinaryId: binary.id, // Use binary ID instead of raw audio data
              returnTranscriptionOnly: true, // Just get transcription, not response
            },
          );

          console.log("Transcription response:", {
            success: transcriptionResponse.success,
            hasTranscription: !!transcriptionResponse.transcription,
            error: transcriptionResponse.error,
          });

          // Wait for placeholder update to propagate - longer wait to ensure completion
          console.log("Waiting for transcription to complete and propagate...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await receiveThread(threadId);

          // Additional wait to ensure UI is updated before proceeding
          await new Promise((resolve) => setTimeout(resolve, 500));

          // If transcription failed, try alternative approach
          if (!transcriptionResponse.success || !transcriptionResponse.transcription) {
            console.warn("Transcription failed or empty:", transcriptionResponse.error);
            console.log("Trying alternative approach with direct audio processing...");

            // Check if audio is valid base64
            let valid = true;
            try {
              // Simple check to see if this is valid base64
              atob(audioData.substring(0, 100));
            } catch (e) {
              valid = false;
              console.error("Audio data is not valid base64:", e);
            }

            if (valid) {
              // Try direct approach by updating the placeholder with the audio data
              try {
                console.log("Updating placeholder directly with audio data...");
                const updateResponse = await medplum.updateResource({
                  resourceType: "Communication",
                  id: placeholderMessageId,
                  status: "in-progress",
                  payload: [{ contentString: "Audio received. Processing..." }],
                  extension: [
                    {
                      url: "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data",
                      valueString: audioData,
                    },
                  ],
                });

                console.log("Placeholder updated with audio data:", !!updateResponse);

                // Now try to process with the bot for a response
                console.log("STEP 2 (Alternative): Generating response with raw audio...");
                const aiResponse = await medplum.executeBot(
                  {
                    system: "https://progressnotes.app",
                    value: "reflection-guide",
                  },
                  {
                    patientId: profile.id,
                    threadId: threadId,
                    messageId: placeholderMessageId,
                    processAudio: true,
                    skipTextDisplay: true, // Don't display the transcription text again
                  },
                );

                console.log("Alternative approach response:", {
                  success: aiResponse.success,
                  hasResponseContent: !!aiResponse.responseContent,
                  hasAudio: !!aiResponse.audioData,
                  error: aiResponse.error,
                });
              } catch (error) {
                console.error("Alternative approach failed:", error);
              }
            }

            // Refresh the thread regardless
            console.log("Waiting for alternative processing to complete...");
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Longer wait for alternative approach
            await receiveThread(threadId);

            // Return placeholder ID
            return placeholderMessageId;
          }

          // Normal flow when transcription is successful
          console.log(
            "STEP 2: Generating AI response to transcription:",
            transcriptionResponse.transcription,
          );

          // Now generate the AI response using the transcription
          try {
            const aiResponse = await medplum.executeBot(
              {
                system: "https://progressnotes.app",
                value: "reflection-guide",
              },
              {
                patientId: profile.id,
                threadId: threadId,
                textInput: transcriptionResponse.transcription,
                skipMessageCreation: true, // Don't create a new message, we already have the placeholder
              },
            );

            console.log("Reflection guide bot response:", {
              success: aiResponse.success,
              hasResponseContent: !!aiResponse.responseContent,
              hasAudio: !!aiResponse.audioData,
              error: aiResponse.error,
            });

            if (!aiResponse.success) {
              console.error("AI response generation failed:", aiResponse.error);
            }
          } catch (error) {
            console.error("Error generating AI response:", error);
          } finally {
            // Wait for response to propagate regardless of success/failure
            console.log("Waiting for AI response to propagate...");
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Longer wait for AI processing
            await receiveThread(threadId);
          }

          return placeholderMessageId; // Return placeholder ID as it was updated
        } else {
          // Normal flow - create a new message
          newCommunication = await createThreadMessageComm({
            medplum,
            profile,
            patientRef: thread.subject as Reference<Patient>,
            message: message ?? "",
            threadId,
            attachment: uploadedAttachment,
            audioData,
            audioContentType: "audio/mp3", // Using MP3 format
          });

          // Touch the thread last changed date
          await touchThreadLastChanged({
            medplum,
            threadId,
            value: newCommunication.sent!,
          });

          // Update the thread messages
          setThreadCommMap((prev) => {
            const existing = prev.get(threadId) || [];
            return new Map([...prev, [threadId, syncResourceArray(existing, newCommunication)]]);
          });

          // Process with AI if requested and is a reflection thread, but not if skipAIProcessing is true
          if (processWithAI && !skipAIProcessing) {
            const threadObj = Thread.fromCommunication({
              comm: thread,
              threadMessageComms: threadCommMap.get(threadId) || [],
            });

            if (threadObj.isReflectionThread) {
              // Process asynchronously
              processWithReflectionGuide({
                threadId,
                messageId: newCommunication.id,
                textInput: message,
                audioData,
                skipMessageCreation: true, // Don't create a new message, update the existing one
              }).catch((e) => {
                console.error("Error processing with reflection guide:", e);
                onError?.(e as Error);
              });
            }
          }

          return newCommunication.id;
        }
      } catch (err) {
        onError?.(err as Error);
        throw err;
      }
    },
    [profile, threads, threadCommMap, medplum, onError, receiveThread],
  );

  const markMessageAsRead = useCallback(
    async ({ threadId, messageId }: { threadId: string; messageId: string }) => {
      // Get the message
      const threadComms = threadCommMap.get(threadId) || [];
      const message = threadComms.find((c) => c.id === messageId);
      if (!message) return;

      // Check if the message is already read
      if (message.status === "completed") return;

      // Check if the message is outgoing
      const isIncoming =
        message.sender &&
        profile &&
        getReferenceString(message.sender) !== getReferenceString(profile);
      if (!isIncoming) return;

      // Mark the message as read
      const updatedCommunication = await medplum.patchResource("Communication", messageId, [
        { op: "add", path: "/status", value: "completed" },
      ]);
      setThreadCommMap((prev) => {
        const existing = prev.get(threadId) || [];
        return new Map([...prev, [threadId, syncResourceArray(existing, updatedCommunication)]]);
      });
    },
    [threadCommMap, medplum, profile],
  );

  const deleteMessages = useCallback(
    async ({ threadId, messageIds }: { threadId: string; messageIds: string[] }) => {
      if (!profile) return;

      try {
        // Delete each message in parallel
        await Promise.all(
          messageIds.map((messageId) => medplum.deleteResource("Communication", messageId)),
        );

        // Update the thread's last changed date to trigger a refresh
        await touchThreadLastChanged({
          medplum,
          threadId,
          value: new Date().toISOString(),
        });
      } catch (error) {
        console.error("ChatContext: Error deleting messages:", error);
        onError?.(error as Error);
        throw error;
      }
    },
    [medplum, profile, onError],
  );

  // Function to process a message with the reflection guide bot
  const processWithReflectionGuide = useCallback(
    async ({
      threadId,
      messageId,
      textInput,
      audioData,
      skipMessageCreation,
    }: {
      threadId: string;
      messageId?: string;
      textInput?: string;
      audioData?: string;
      skipMessageCreation?: boolean;
    }) => {
      if (!profile) return;

      // Set processing state to true for this thread
      setIsBotProcessingMap((prev) => new Map([...prev, [threadId, true]]));
      console.log(`Bot processing starting for thread: ${threadId}`);

      try {
        console.log("Processing with reflection guide bot:", {
          threadId,
          messageId: messageId?.substring(0, 8),
          hasTextInput: !!textInput,
          hasAudioData: !!audioData?.substring(0, 20) + "...",
        });

        // First, check if the bot exists by making a direct query
        let botExists = false;
        try {
          // Try to find the bot by identifier
          const searchResults = await medplum.search("Bot", {
            identifier: "https://progressnotes.app|reflection-guide",
          });

          botExists = searchResults.entry && searchResults.entry.length > 0;

          if (!botExists) {
            console.log("Reflection guide bot not found. Creating placeholder message response.");

            // Create a placeholder response message from the system
            await createThreadMessageComm({
              medplum,
              profile: {
                resourceType: "Practitioner",
                id: "system",
                name: [{ given: ["Reflection"], family: "Guide" }],
              } as ProfileResource,
              patientRef:
                profile.resourceType === "Patient"
                  ? ({ reference: `Patient/${profile.id}` } as Reference<Patient>)
                  : (threads.find((t) => t.id === threadId)?.subject as Reference<Patient>),
              message:
                "I'm sorry, the reflection guide bot is not available. Please contact support for assistance.",
              threadId: threadId,
            });

            // Refresh thread to show placeholder message
            await receiveThread(threadId);
            return;
          }
        } catch (botCheckError) {
          console.error("Error checking for bot existence:", botCheckError);
          // Continue to try executing the bot anyway
        }

        // Execute the reflection-guide bot if it exists or if we couldn't check

        // First create an audio attachment if we have audio data
        let audioBinaryId;
        if (audioData) {
          try {
            console.log("Creating audio attachment for bot processing...");

            // Convert base64 to blob for the attachment
            const byteCharacters = atob(audioData);
            const byteArrays = [];
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
              }
              byteArrays.push(new Uint8Array(byteNumbers));
            }

            const blob = new Blob(byteArrays, { type: "audio/mp3" });
            const audioAttachment = await medplum.createAttachment({
              data: blob,
              contentType: "audio/mp3",
            });

            audioBinaryId = audioAttachment.id;
            console.log("Created audio attachment with ID:", audioBinaryId);
          } catch (attachmentError) {
            console.error("Failed to create audio attachment:", attachmentError);
            // Continue without audio if attachment creation fails
          }
        }

        const response = await medplum.executeBot(
          {
            system: "https://progressnotes.app",
            value: "reflection-guide",
          },
          {
            patientId: profile.id,
            threadId: threadId,
            messageId: messageId,
            textInput: textInput || (audioData ? "[Audio message]" : undefined),
            audioBinaryId: audioBinaryId,
            skipMessageCreation: skipMessageCreation, // Don't create a new message when updating an existing one
            config: {
              voiceModel: "aura-2-cora-en",
              persona: "empathetic, supportive guide",
              theme: "general well-being and mental health",
            },
          },
        );

        console.log("Reflection guide bot response:", {
          success: response.success,
          hasResponseContent: !!response.responseContent,
          hasAudio: !!response.audioData?.substring(0, 20) + "...",
          error: response.error,
        });

        if (!response.success) {
          // Find the thread first to make sure it exists
          const thread = threads.find((t) => t.id === threadId);
          if (!thread) {
            console.error(
              `Thread with ID ${threadId} not found when trying to create error message`,
            );
            return;
          }

          // Create an error message in the thread
          await createThreadMessageComm({
            medplum,
            profile: {
              resourceType: "Practitioner",
              id: "system",
              name: [{ given: ["Reflection"], family: "Guide" }],
            } as ProfileResource,
            patientRef:
              profile.resourceType === "Patient"
                ? ({ reference: `Patient/${profile.id}` } as Reference<Patient>)
                : (thread.subject as Reference<Patient>),
            message: `Sorry, I couldn't process your message. ${response.error || "Please try again later."}`,
            threadId: threadId,
          });
        }

        // Refresh thread to show AI response
        await receiveThread(threadId);
      } catch (err) {
        console.error("Error processing with reflection guide:", err);

        try {
          // Find the thread first to make sure it exists
          const thread = threads.find((t) => t.id === threadId);
          if (!thread) {
            console.error(
              `Thread with ID ${threadId} not found when trying to create error message`,
            );
            return;
          }

          // Create an error message in the thread
          await createThreadMessageComm({
            medplum,
            profile: {
              resourceType: "Practitioner",
              id: "system",
              name: [{ given: ["Reflection"], family: "Guide" }],
            } as ProfileResource,
            patientRef:
              profile.resourceType === "Patient"
                ? ({ reference: `Patient/${profile.id}` } as Reference<Patient>)
                : (thread.subject as Reference<Patient>),
            message:
              "I'm sorry, I encountered an error while processing your message. Please try again later.",
            threadId: threadId,
          });

          // Refresh thread to show error message
          await receiveThread(threadId);
        } catch (errorMessageError) {
          console.error("Failed to create error message:", errorMessageError);
        }

        onError?.(err as Error);
      } finally {
        // Set processing state back to false for this thread
        setIsBotProcessingMap((prev) => new Map([...prev, [threadId, false]]));
        console.log(`Bot processing completed for thread: ${threadId}`);
      }
    },
    [medplum, profile, receiveThread, onError, threads, setIsBotProcessingMap],
  );

  const value = {
    threads: threadsOut,
    isLoadingThreads,
    isLoadingMessagesMap,
    isBotProcessingMap,
    connectedOnce,
    reconnecting,
    createThread,
    receiveThread,
    sendMessage,
    markMessageAsRead,
    deleteMessages,
    processWithReflectionGuide,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
