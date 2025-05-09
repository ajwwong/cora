import { useContextSelector } from "use-context-selector";

import { ChatContext } from "@/contexts/ChatContext";

/**
 * Custom hook to access the audio regeneration functionality from ChatContext
 */
export function useChatAudioRegeneration() {
  const regenerateAudio = useContextSelector(
    ChatContext,
    (state) => state.regenerateAudio || (async () => false),
  );

  return {
    regenerateAudio,
  };
}
