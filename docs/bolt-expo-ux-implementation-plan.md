# Bolt-Expo UX Implementation Plan for Cora

This document outlines a comprehensive plan to enhance the Cora application with UX improvements from the Bolt-Expo project. The goal is to maintain Cora's robust architecture while incorporating Bolt-Expo's more polished and user-friendly interface elements.

## Overview

Bolt-Expo features a more modern, streamlined user experience with better visual hierarchy, consistent styling, and improved audio components. This plan focuses on four key areas:

1. **Navigation & App Structure**: Implementing tab-based navigation and improved layouts
2. **Audio Experience**: Enhancing audio recording and playback components
3. **Chat UI**: Improving message bubbles, typing indicators, and input functionality
4. **Onboarding Flow**: Creating a more immersive and informative first-time user experience

## 1. Navigation & App Structure

### 1.1 Tab-Based Navigation

**Current State**: Cora uses a header-based navigation with modal dialogs for settings.

**Implementation Plan**:

1. Create a new tab layout structure in `app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';
import { MessageSquare, User, Settings } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#6366f1', // Primary theme color
        tabBarInactiveTintColor: '#a1a1aa',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Threads',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

2. Move thread list and chat to `app/(tabs)/index.tsx`
3. Create new profile screen at `app/(tabs)/profile.tsx`
4. Convert `SettingsModal.tsx` to full screen page at `app/(tabs)/settings.tsx`

### 1.2 Header Redesign

**Current State**: Cora uses `ChatHeader.tsx` and `ThreadListHeader.tsx` components.

**Implementation Plan**:

1. Update headers with cleaner styling and consistent height
2. Simplify header actions to focus on essential functions
3. Add subtle gradient backgrounds for visual hierarchy

## 2. Audio Experience

### 2.1 Enhanced VoiceRecorder

**Current State**: Cora uses `useAudioRecording` hook with integrated UI in the chat input.

**Implementation Plan**:

1. Create a standalone `VoiceRecorder` component based on Bolt-Expo's implementation:
```tsx
// components/VoiceRecorder.tsx
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Microphone, Square, AlertCircle } from 'lucide-react-native';
import { useAudioRecording } from '../hooks/useAudioRecording';

export function VoiceRecorder({ onRecordingComplete }) {
  const [error, setError] = useState<string | null>(null);
  
  const { 
    startRecording, 
    stopRecording, 
    isRecording, 
    recordingError 
  } = useAudioRecording();
  
  const handleToggleRecording = async () => {
    try {
      if (isRecording) {
        const uri = await stopRecording();
        onRecordingComplete(uri);
      } else {
        await startRecording();
        setError(null);
      }
    } catch (err) {
      setError('Could not access microphone');
    }
  };
  
  return (
    <View className="flex-row items-center">
      <Pressable
        className={`aspect-square rounded-full p-3 ${
          isRecording ? "bg-red-500" : "bg-primary-100"
        }`}
        onPress={handleToggleRecording}
      >
        {isRecording ? (
          <Square size={24} color="#ffffff" />
        ) : (
          <Microphone size={24} color="#6366f1" />
        )}
      </Pressable>
      {(error || recordingError) && (
        <View className="flex-row items-center ml-2">
          <AlertCircle size={16} color="#ef4444" />
          <Text className="text-xs text-red-500 ml-1">
            {error || recordingError}
          </Text>
        </View>
      )}
    </View>
  );
}
```

2. Update `ChatMessageInput.tsx` to use the new component
3. Add audio level visualization similar to Bolt-Expo

### 2.2 Improved AudioPlayer

**Current State**: Simple audio playback functionality in chat bubbles.

**Implementation Plan**:

1. Create an enhanced `AudioPlayer` component:
```tsx
// components/AudioPlayer.tsx
import React, { useState, useEffect } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Play, Pause, AlertCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';

export function AudioPlayer({ uri }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);
  
  const playSound = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      setError('Couldn't play audio');
    }
  };
  
  return (
    <View className="flex-row items-center">
      <Pressable
        className={`aspect-square rounded-full p-2 ${
          isPlaying ? "bg-primary-200" : "bg-primary-100"
        }`}
        onPress={playSound}
      >
        {isPlaying ? (
          <Pause size={20} color="#6366f1" />
        ) : (
          <Play size={20} color="#6366f1" />
        )}
      </Pressable>
      {error && (
        <View className="flex-row items-center ml-2">
          <AlertCircle size={14} color="#ef4444" />
          <Text className="text-xs text-red-500 ml-1">{error}</Text>
        </View>
      )}
    </View>
  );
}
```

2. Add handling for different file formats and platform-specific behavior
3. Implement audio duration display

## 3. Chat UI

### 3.1 Enhanced Chat Bubbles

**Current State**: Cora uses `ChatMessageBubble.tsx` with a basic design.

**Implementation Plan**:

1. Update message bubbles with gradient backgrounds for user messages:
```tsx
// Within ChatMessageBubble.tsx
import { LinearGradient } from 'expo-linear-gradient';

// For user messages
<LinearGradient
  colors={['#8B5CF6', '#6366F1']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  className="rounded-2xl p-3"
>
  <Text className="text-white">{message.content}</Text>
</LinearGradient>

// For AI messages (keep existing style but enhance)
<View className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-3">
  <Text className="text-neutral-800 dark:text-white">{message.content}</Text>
</View>
```

2. Improve spacing and alignment for better visual hierarchy
3. Add subtle animation for new messages

### 3.2 Typing Indicator

**Current State**: Cora has a simple `LoadingDots` component.

**Implementation Plan**:

1. Create a new `TypingIndicator` component based on Bolt-Expo:
```tsx
// components/TypingIndicator.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export function TypingIndicator() {
  const animations = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const sequence = Animated.stagger(
      150,
      animations.map(animation =>
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      )
    );

    Animated.loop(sequence).start();

    return () => {
      animations.forEach(animation => animation.stopAnimation());
    };
  }, []);

  return (
    <View className="flex-row items-center justify-center p-2 gap-1">
      {animations.map((animation, index) => (
        <Animated.View
          key={index}
          style={{
            opacity: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [
              {
                scale: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                }),
              },
            ],
          }}
          className="w-2 h-2 rounded-full bg-neutral-400"
        />
      ))}
    </View>
  );
}
```

2. Replace `LoadingDots` with `TypingIndicator` in chat interface

### 3.3 Search Functionality

**Current State**: Cora doesn't have message search functionality.

**Implementation Plan**:

1. Add a new `SearchBar` component to thread list:
```tsx
// components/SearchBar.tsx
import React, { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';

export function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  
  const handleClear = () => {
    setQuery('');
    onSearch('');
  };
  
  const handleChange = (text) => {
    setQuery(text);
    onSearch(text);
  };
  
  return (
    <View className="flex-row items-center bg-neutral-100 dark:bg-neutral-800 rounded-full px-3 py-2 mb-4">
      <Search size={18} color="#71717a" />
      <TextInput
        value={query}
        onChangeText={handleChange}
        placeholder="Search conversations"
        className="flex-1 ml-2 text-neutral-800 dark:text-white"
        placeholderTextColor="#a1a1aa"
      />
      {query.length > 0 && (
        <Pressable onPress={handleClear}>
          <X size={18} color="#71717a" />
        </Pressable>
      )}
    </View>
  );
}
```

2. Implement search functionality in the `ThreadList` component
3. Add highlight for search results in messages

## 4. Onboarding Flow

### 4.1 New User Onboarding

**Current State**: Cora uses a modal-based `WelcomeWalkthrough` component.

**Implementation Plan**:

1. Create dedicated onboarding route group:
```
app/
  /(onboarding)/
    _layout.tsx       # Layout with no header
    welcome.tsx       # Introduction screen
    communication.tsx # Preference selection
    features.tsx      # Feature overview 
```

2. Implement welcome screen with gradient background:
```tsx
// app/(onboarding)/welcome.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function Welcome() {
  return (
    <LinearGradient
      colors={['#8B5CF6', '#6366F1']}
      className="flex-1 justify-center items-center px-6"
    >
      <View className="w-full max-w-md">
        <Text className="text-3xl font-bold text-white mb-4">
          Welcome to Cora
        </Text>
        <Text className="text-xl text-white mb-8">
          Your secure therapeutic reflection assistant
        </Text>
        <Pressable
          className="bg-white py-4 rounded-full"
          onPress={() => router.push('/(onboarding)/communication')}
        >
          <Text className="text-center text-primary-600 font-bold">
            Get Started
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
```

3. Migrate existing walkthrough content to the new flow

### 4.2 User Preferences

**Current State**: Preferences are set in settings after login.

**Implementation Plan**:

1. Create preference selection screen:
```tsx
// app/(onboarding)/communication.tsx
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Microphone, MessageSquare } from 'lucide-react-native';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';

export default function Communication() {
  const { setCommunicationPreference } = useUserPreferences();
  const [selected, setSelected] = useState<'voice' | 'text'>('text');
  
  const handleContinue = () => {
    setCommunicationPreference(selected);
    router.push('/(onboarding)/features');
  };
  
  return (
    <LinearGradient
      colors={['#8B5CF6', '#6366F1']}
      className="flex-1 justify-center items-center px-6"
    >
      <View className="w-full max-w-md">
        <Text className="text-2xl font-bold text-white mb-4">
          How would you like to communicate?
        </Text>
        
        <Pressable
          className={`flex-row items-center p-4 mb-4 rounded-xl ${
            selected === 'voice' ? 'bg-white' : 'bg-white/20'
          }`}
          onPress={() => setSelected('voice')}
        >
          <Microphone 
            size={24} 
            color={selected === 'voice' ? '#6366F1' : '#ffffff'} 
          />
          <View className="ml-3">
            <Text 
              className={`font-bold ${
                selected === 'voice' ? 'text-primary-600' : 'text-white'
              }`}
            >
              Voice Messages
            </Text>
            <Text 
              className={selected === 'voice' ? 'text-neutral-600' : 'text-white/80'}
            >
              Record audio messages for faster communication
            </Text>
          </View>
        </Pressable>
        
        <Pressable
          className={`flex-row items-center p-4 mb-4 rounded-xl ${
            selected === 'text' ? 'bg-white' : 'bg-white/20'
          }`}
          onPress={() => setSelected('text')}
        >
          <MessageSquare 
            size={24} 
            color={selected === 'text' ? '#6366F1' : '#ffffff'} 
          />
          <View className="ml-3">
            <Text 
              className={`font-bold ${
                selected === 'text' ? 'text-primary-600' : 'text-white'
              }`}
            >
              Text Messages
            </Text>
            <Text 
              className={selected === 'text' ? 'text-neutral-600' : 'text-white/80'}
            >
              Type your messages for more precise communication
            </Text>
          </View>
        </Pressable>
        
        <Pressable
          className="bg-white py-4 rounded-full mt-4"
          onPress={handleContinue}
        >
          <Text className="text-center text-primary-600 font-bold">
            Continue
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
```

2. Add user preference storage to `UserPreferencesContext`
3. Configure chat input based on selected preferences

## Implementation Timeline

### Phase 1: Audio Experience (Weeks 1-2)
- Implement enhanced AudioPlayer component
- Create standalone VoiceRecorder component
- Update ChatMessageInput to use new components

### Phase 2: Chat UI (Weeks 3-4)
- Enhance ChatMessageBubble styling
- Implement improved TypingIndicator
- Add SearchBar and search functionality

### Phase 3: Navigation (Weeks 5-6)
- Implement tab-based navigation structure
- Create Profile screen
- Convert Settings modal to full screen

### Phase 4: Onboarding (Weeks 7-8)
- Create onboarding route group and screens
- Implement preference selection
- Connect onboarding flow to main app

## Conclusion

This implementation plan provides a detailed roadmap for incorporating Bolt-Expo's UX improvements into the Cora app. By focusing on these four key areas, we can significantly enhance the user experience while maintaining the robust architecture that makes Cora reliable and powerful.

The changes prioritize:
- Improved visual design and consistency
- Enhanced audio recording and playback experience
- More intuitive navigation
- Better onboarding for new users

This approach allows us to iteratively implement changes without disrupting the core functionality, while bringing a more polished and user-friendly experience to Cora users.