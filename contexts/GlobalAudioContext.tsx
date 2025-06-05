import { Audio } from "expo-av";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Define the context shape
interface GlobalAudioContextType {
  playingId: string | null;
  playingThreadId: string | null;
  isPlaying: boolean;
  play: (id: string, threadId: string, audioData: string) => Promise<void>;
  stop: () => Promise<void>;
}

// Create context with default values
const GlobalAudioContext = createContext<GlobalAudioContextType>({
  playingId: null,
  playingThreadId: null,
  isPlaying: false,
  play: async () => {},
  stop: async () => {},
});

// Provider component
export function GlobalAudioProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingThreadId, setPlayingThreadId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [_isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Clean up sound when component unmounts
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  // Stop any currently playing audio
  const stop = useCallback(async () => {
    if (soundRef.current) {
      try {
        console.log("Stopping audio playback");
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (err) {
        console.error("Error stopping audio:", err);
      } finally {
        soundRef.current = null;
      }
    }
    setIsPlaying(false);
    setPlayingId(null);
    setPlayingThreadId(null);
  }, []);

  // Play audio with the given ID
  const play = useCallback(
    async (id: string, threadId: string, audioData: string) => {
      console.log(`Playing audio ID: ${id} in thread: ${threadId}`);

      // If already playing, stop it first
      if (soundRef.current) {
        await stop();

        // If the same audio, just stop (toggle behavior)
        if (id === playingId) {
          return;
        }
      }

      setIsLoading(true);

      try {
        // Set audio mode for playback to use speaker
        console.log("Setting audio mode for playback...");
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // Force speaker on Android
          interruptionModeIOS: 2, // DUCK_OTHERS
          interruptionModeAndroid: 1, // DUCK_OTHERS
        });

        // Create a data URI from the base64 audio data
        const base64Audio = `data:audio/mp3;base64,${audioData}`;

        // Create and play the sound
        console.log("Creating new sound object");
        const { sound } = await Audio.Sound.createAsync(
          { uri: base64Audio },
          { shouldPlay: true },
          (status) => {
            // Update playing state when playback completes
            if (
              status.isLoaded &&
              (status.didJustFinish ||
                (status.positionMillis === status.durationMillis && status.durationMillis > 0))
            ) {
              console.log("Audio playback completed");
              setIsPlaying(false);
            }
          },
        );

        // Store the sound reference
        soundRef.current = sound;

        // Update state
        setPlayingId(id);
        setPlayingThreadId(threadId);
        setIsPlaying(true);
      } catch (error) {
        console.error("Error playing audio:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [stop, playingId],
  );

  return (
    <GlobalAudioContext.Provider
      value={{
        playingId,
        playingThreadId,
        isPlaying,
        play,
        stop,
      }}
    >
      {children}
    </GlobalAudioContext.Provider>
  );
}

// Custom hook for easier usage
export const useGlobalAudio = () => useContext(GlobalAudioContext);
