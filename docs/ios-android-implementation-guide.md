# Cora FeelHeard.me App: iOS and Android Implementation Guide

This document provides a comprehensive guide for iOS and Android mobile developers to bring the Cora Health app to completion on mobile platforms. It outlines the architecture, key components, and specific considerations for mobile implementation.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Key Components](#key-components)
4. [Authentication Flow](#authentication-flow)
5. [Data Models](#data-models)
6. [Native Features](#native-features)
7. [Push Notifications](#push-notifications)
8. [Known Issues and Challenges](#known-issues-and-challenges)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Resources](#resources)

## Project Overview

Cora is a health chat application built with Expo and React Native, a minor variation on the open source medplum-chat-app project. It provides a messaging interface for patients to connect with a "reflection guide" AI assistant. The original medplum-chat-app was designed for mobile devices but when we branched it into the Cora app we primarily did deveopment for the web app version. This has allowed us to iterate quickly on the web -- and we have a working web app but now requires optimization for iOS and Android platforms.

**Key Features:**
- Chat between patients and a reflection guide AI assistant
- Media attachments (images, audio)  -- images are existinng in legacy medplum-chat-app but not needed in Cora
- Thread-based conversation management
- OAuth2 authentication with Medplum
- Push notifications for new messages  -- not needed in Cora
- Audio recording and transcription capabilities  -- new in Cora (as differentiator from legacy medplum-chat-app)
- Reflection guide AI assistant integration  -- new in Cora (as differentiator from legacy medplum-chat-app)

## Architecture

The application follows a modern React Native architecture using Expo framework with the following key patterns:

### Tech Stack
- **Expo SDK 53** - Application framework
- **React Native 0.79.2** - Mobile UI framework
- **TypeScript** - Type-safe JavaScript
- **expo-router** - File-based routing
- **GlueStack UI** - Component library
- **NativeWind** - Tailwind CSS for React Native
- **Medplum SDK** - Healthcare API integration

### Project Structure
- `/app/` - Main application screens and routing
- `/components/` - Reusable UI components
- `/contexts/` - React Context providers
- `/hooks/` - Custom React hooks
- `/models/` - Data models and type definitions
- `/utils/` - Utility functions
- `/bots/` - Serverless functions for background processing
- `/assets/` - Images, fonts, and other static assets

### State Management
The app uses React Context for state management:
- `ChatContext` - Manages threads, messages, and chat operations
- `NotificationsContext` - Handles push notification registration and delivery  -- not needed in Cora
- `UserPreferencesContext` - Stores user preferences and settings

### Server-Side Bot Functions
The app integrates with several server-side Lambda functions (Medplum Bots) that provide core functionality:

1. **reflection-guide.ts** -- key differentiator in Cora vs. legacy app
   - Main AI assistant that provides reflective responses to user messages
   - Processes both text and audio inputs
   - Manages conversation flow and context
   - Located in progress2-base folder on the server

2. **ask-claude.ts** -- key differentiator in Cora vs. legacy app
   - Integrates with Claude AI via API
   - Processes user messages to generate thoughtful responses
   - Maintains conversation context for better continuity
   - Located in progress2-base folder on the server

3. **audio-transcribe.ts** -- key differentiator in Cora vs. legacy app
   - Handles audio transcription using Deepgram API
   - Converts voice recordings to text for AI processing
   - Supports multiple audio formats
   - Located in progress2-base folder on the server

These bot functions are called from the client app via the Medplum API, primarily through the `processWithReflectionGuide()` function in the ChatContext.

## Key Components

### Core UI Components
1. **ThreadList** (`components/ThreadList.tsx`) - Displays a list of conversation threads
2. **ChatMessageList** (`components/ChatMessageList.tsx`) - Renders messages within a thread
3. **ChatMessageBubble** (`components/ChatMessageBubble.tsx`) - Individual message component
4. **ChatMessageInput** (`components/ChatMessageInput.tsx`) - Input field with media attachment buttons
5. **CreateThreadModal** (`components/CreateThreadModal.tsx`) - Modal for creating new chat threads

### Screens
1. **Sign In** (`app/sign-in.tsx`) - OAuth authentication screen
2. **Thread List** (`app/(app)/index.tsx`) - Main screen showing all user threads
3. **Thread Detail** (`app/(app)/thread/[id].tsx`) - Detailed thread view with messages

### Navigation
The app uses `expo-router` for file-based routing:
- Root layout (`app/_layout.tsx`) - Sets up providers and global navigation
- App layout (`app/(app)/_layout.tsx`) - Manages authenticated screens

## Authentication Flow

The application uses OAuth2 authentication with Medplum as the identity provider:

1. **Configuration** (`utils/medplum-oauth2.ts`)
   - Different client IDs for web vs. native platforms
   - Authorization and token endpoints defined

2. **Sign-In Process** (`app/sign-in.tsx`)
   - Uses `expo-auth-session` for OAuth flow
   - PKCE (Proof Key for Code Exchange) for enhanced security
   - Stores tokens securely using Medplum client

3. **Redirect URIs**
   - Mobile platforms require properly configured URI schemes
   - Current implementation uses dynamically generated URIs with `makeRedirectUri()`

### Mobile-Specific Authentication Considerations
1. **URI Scheme Registration**: Register custom URI scheme in app.json/app.config.ts
2. **Deep Linking**: Configure deep links to handle authentication redirects
3. **Secure Storage**: Ensure tokens are stored securely using `expo-secure-store`

## Data Models

The application uses FHIR resources via Medplum's API, with custom wrapper classes:

### Chat Models (`models/chat.ts`)
1. **ChatMessage** - Wraps `Communication` FHIR resource for messages
2. **Thread** - Wraps `Communication` FHIR resource for conversation threads

### Key Relationships
- **Thread**: A `Communication` resource without `partOf` reference
- **Message**: A `Communication` resource with `partOf` reference to a Thread
- **Sender**: Reference to `Patient` or `Practitioner` resource
- **Subject**: Always references a `Patient` resource

## Native Features

The application leverages several native device capabilities that require special attention for mobile deployment:

### Media Handling
1. **Image Picker** (`expo-image-picker`)   --- not needed in Cora so you can ignore this part of the code
   - Photo library access
   - Camera access for capturing photos
   - Permission handling

2. **Audio Recording** (`hooks/useAudioRecording.tsx`)  --- new in Cora (as differentiator from legacy medplum-chat-app)
   - Microphone access using `expo-av` -- or actually perhaps 'expo-audio' since I think expo-av may be deprecated soon
   - Audio recording, playback, and uploading
   - Permission handling

3. **File System Access** (`expo-file-system`)  --- not needed in Cora so you can ignore this part of the code
   - Temporary storage for media files
   - Caching attachments

### Deep Linking
- Used for authentication callbacks
- Thread navigation from push notifications  -- not needed in Cora so you can ignore this part of the code
- Custom URL scheme: `myapp://`

## Push Notifications  -- not needed in Cora so you can ignore this part of the code*** 

Push notifications are implemented using Expo's push notification service:  

### Client-Side (`contexts/NotificationsContext.tsx`)  -- not needed in Cora so you can ignore this part of the code
1. **Registration**  -- not needed in Cora so you can ignore this part of the code
   - Requests notification permissions
   - Obtains and registers Expo push tokens
   - Stores token in user profile

2. **Handling**  -- not needed in Cora so you can ignore this part of the code
   - Processes incoming notifications
   - Navigates to relevant threads
   - Updates unread message counts

### Server-Side (`bots/notification-bot.ts`)  -- not needed in Cora so you can ignore this part of the code
1. **Subscription Processing**  -- not needed in Cora so you can ignore this part of the code
   - Listens for new `Communication` resources
   - Determines recipients based on sender type
   - Sends notifications via Expo's push API

### Mobile-Specific Notification Requirements
1. **iOS**
   - APNs (Apple Push Notification service) configuration  -- not needed in Cora so you can ignore this part of the code
   - Background modes for remote notifications  -- not needed in Cora so you can ignore this part of the code
   - Permission request UI  -- may need to access microphone for audio recording

2. **Android**
   - Firebase Cloud Messaging (FCM) setup  -- not needed in Cora so you can ignore this part of the code
   - Notification channels configuration  -- not needed in Cora so you can ignore this part of the code
   - Permission handling for Android 13+  -- may need to access microphone for audio recording

## Known Issues and Challenges

The following issues have been identified during web development that need addressing for mobile platforms:

1. **TurboModuleRegistry Error**
   - Related to React Native's new architecture
   - Toggle `newArchEnabled` in app.config.ts if needed

2. **OAuth Redirect Issues**
   - Hardcoded redirect URI in sign-in.tsx
   - Need to dynamically generate appropriate URIs per platform

3. **Reanimated Initialization**
   - Native modules may not initialize correctly
   - Requires proper plugin configuration in babel.config.js

4. **Network Connectivity**
   - Current implementation may have CORS-related issues
   - Need to handle offline scenarios gracefully

## Implementation Roadmap

The following steps are recommended for completing the iOS and Android implementation:

### 1. Environment Setup
1. Configure development environment for iOS and Android
2. Set up native build tools (Xcode, Android Studio)
3. Configure EAS Build for CI/CD

### 2. Authentication
1. Implement platform-specific OAuth flows
2. Configure deep linking and URL schemes
3. Test token refresh and session management

### 3. Push Notifications
1. Set up APNs and FCM credentials
2. Implement notification handling for both platforms
3. Test background and foreground notification scenarios

### 4. Native Features
1. Focus on audio recording integration -- key differentiator in Cora vs. legacy app
2. Implement efficient audio recording and playback
3. Handle microphone permissions appropriately for each platform
4. Ensure smooth integration with server-side audio transcription bot

### 5. UI/UX Optimization
1. Ensure responsive layout across device sizes
2. Implement platform-specific UI patterns where appropriate
3. Add animations and transitions for a polished feel

### 6. Testing
1. Conduct device-specific testing
2. Performance testing with large conversation threads
3. Accessibility testing

### 7. Distribution
1. Prepare App Store assets and metadata
2. Configure App Store Connect and Google Play Console
3. Implement analytics for monitoring usage

## Resources

### Key Files

1. **App Configuration**
   - `app.config.ts` - Main Expo configuration

2. **Authentication**
   - `app/sign-in.tsx` - Sign-in screen
   - `utils/medplum-oauth2.ts` - OAuth configuration

3. **Data Management**
   - `contexts/ChatContext.tsx` - Main chat functionality
   - `models/chat.ts` - Data models

4. **Push Notifications** -- not needed in Cora so you can ignore this part of the code
   - `bots/notification-bot.ts` - Server-side notification handling  
   - `contexts/NotificationsContext.tsx` - Client-side notification management
   
5. **Server-Side AI Integration** -- key differentiator in Cora vs. legacy app
   - `progress2-base/reflection-guide.ts` - Main AI assistant bot
   - `progress2-base/ask-claude.ts` - Claude AI integration
   - `progress2-base/audio-transcribe.ts` - Audio transcription service

### External Documentation

1. **Expo**
   - [Expo Documentation](https://docs.expo.dev/)
   - [Authentication in Expo](https://docs.expo.dev/guides/authentication/)
   - [Push Notifications](https://docs.expo.dev/push-notifications/overview/)

2. **Medplum**
   - [Medplum API Documentation](https://docs.medplum.com/)
   - [FHIR Resources Guide](https://docs.medplum.com/api/fhir/)

3. **React Native**
   - [React Native Documentation](https://reactnative.dev/docs/getting-started)
   - [Platform Specific Code](https://reactnative.dev/docs/platform-specific-code)

---

## Conclusion

The Cora Health app provides a solid foundation with its web implementation, and with the appropriate platform-specific optimizations, it can deliver a high-quality experience on iOS and Android devices. Focus on authentication flows, push notifications, and native feature integration to ensure a seamless transition to mobile platforms.

The application's architecture follows modern React Native patterns and practices, making it well-suited for extension to native mobile platforms. By following this guide, developers should be able to efficiently complete the iOS and Android implementation while maintaining the core functionality and user experience of the web application.