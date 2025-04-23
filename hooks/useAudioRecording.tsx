import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

interface UseAudioRecordingReturn {
  isRecording: boolean;
  audioBlob: Blob | null;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
}

/**
 * Hook for handling audio recording functionality
 * @returns Recording controls and state
 */
export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Minimize DOM updates by using reference values
  const isRecordingRef = useRef(false);
  
  // Function to update duration (called at a throttled rate)
  const updateDuration = useCallback(() => {
    if (!isRecordingRef.current) return;
    
    const now = Date.now();
    const newDuration = Math.floor((now - startTimeRef.current) / 1000);
    
    // Update duration state (which causes a render)
    setRecordingDuration(newDuration);
    
    // Schedule next update
    timerRef.current = setTimeout(updateDuration, 1000);
  }, []);
  
  // Clean up recording and timer when component unmounts
  // Check permissions on component mount
  useEffect(() => {
    // Check initial permission status
    const checkPermissions = async () => {
      try {
        console.log('Initial microphone permission check...');
        const { status } = await Audio.getPermissionsAsync();
        console.log('Initial microphone permission status:', status);
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    };
    
    checkPermissions();
    
    // Cleanup on unmount
    return () => {
      console.log('Cleaning up audio recording resources');
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  /**
   * Start audio recording
   */
  const startRecording = async () => {
    try {
      console.log('useAudioRecording: startRecording called');
      
      // Request permission
      console.log('Requesting microphone permission...');
      const { status } = await Audio.requestPermissionsAsync();
      console.log('Microphone permission status:', status);
      
      if (status !== 'granted') {
        console.error('Permission to access microphone was denied');
        throw new Error('Permission to access microphone was denied');
      }
      
      // Configure audio mode with settings to minimize update events
      console.log('Configuring audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // Prepare recording
      console.log('Creating recording object...');
      const recording = new Audio.Recording();
      
      try {
        // Use LOW_QUALITY on web to reduce processing
        const preset = Platform.OS === 'web' 
          ? Audio.RecordingOptionsPresets.LOW_QUALITY
          : Audio.RecordingOptionsPresets.HIGH_QUALITY;
          
        console.log('Using recording preset for platform:', Platform.OS);
        console.log('Preparing to record...');
        
        const options = {
          ...preset,
          ...(Platform.OS === 'web' && {
            progressUpdateIntervalMillis: 1000, // Even less frequent updates for web
            keepAudioActiveHint: true,
          }),
        };
        
        await recording.prepareToRecordAsync(options);
        
        console.log('Starting recording...');
        await recording.startAsync();
        console.log('Recording started successfully!');
        
        recordingRef.current = recording;
        
        // Set isRecording via ref first (doesn't cause render)
        isRecordingRef.current = true;
        
        // Track duration
        startTimeRef.current = Date.now();
        setRecordingDuration(0);
        
        // Start duration timer
        timerRef.current = setTimeout(updateDuration, 1000);
        
        // Finally update isRecording state after setup is complete
        setIsRecording(true);
        console.log('Recording state updated: isRecording = true');
      } catch (error) {
        console.error('Failed to start recording:', error);
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error in startRecording:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  };
  
  /**
   * Stop the current recording and return the audio as a Blob
   * @returns Promise that resolves to the recorded audio as a Blob
   */
  const stopRecording = async (): Promise<Blob> => {
    console.log('useAudioRecording: stopRecording called');
    if (!recordingRef.current) {
      console.error('No recording in progress (recordingRef.current is null)');
      console.log('isRecording state:', isRecording);
      console.log('isRecordingRef.current:', isRecordingRef.current);
      throw new Error('No recording in progress');
    }
    
    try {
      // Stop the duration timer
      console.log('Stopping duration timer...');
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // Update refs immediately to prevent any further renders
      console.log('Setting isRecordingRef to false');
      isRecordingRef.current = false;
      
      // Stop the recording
      console.log('Stopping and unloading recording...');
      await recordingRef.current.stopAndUnloadAsync();
      console.log('Recording stopped');
      
      // Get the recording URI
      console.log('Getting recording URI...');
      const uri = recordingRef.current.getURI();
      console.log('Recording URI:', uri);
      
      if (!uri) {
        console.error('Recording URI is null');
        throw new Error('Recording URI is null');
      }
      
      // Convert to blob
      console.log('Fetching recording data from URI...');
      const response = await fetch(uri);
      console.log('Fetched data, converting to blob...');
      const blob = await response.blob();
      console.log('Converted to blob successfully');
      
      // Reset state
      console.log('Setting audioBlob and resetting recordingDuration...');
      setAudioBlob(blob);
      setRecordingDuration(0);
      
      // Only update isRecording at the end, after all processing
      console.log('Setting isRecording to false...');
      setIsRecording(false);
      recordingRef.current = null;
      
      console.log('Recording process completed, blob size:', blob.size);
      return blob;
    } catch (error) {
      console.error('Error stopping recording:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      console.log('Setting isRecording to false after error...');
      setIsRecording(false);
      setRecordingDuration(0);
      recordingRef.current = null;
      throw error;
    }
  };
  
  return {
    isRecording,
    audioBlob,
    recordingDuration,
    startRecording,
    stopRecording
  };
}