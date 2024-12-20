# [⚠️ UNDER CONSTRUCTION] Health Chat App 🩺

A sample healthcare mobile application built with Expo and React Native, using [Medplum](https://www.medplum.com/) as the backend EHR system. This app demonstrates how to build FHIR-native mobile applications for healthcare.

## Features

### OAuth2 Authentication with Medplum

The app uses OAuth2 to authenticate users with a Medplum instance.

### Secure Chat System

The app implements a secure chat system following Medplum's ["Organizing Communications Using Threads"](https://www.medplum.com/docs/communications/organizing-communications) architecture. This allows patients to:

- View all their chat threads with healthcare providers
- Send and receive messages in real-time
- Access chat history securely

The chat system is built using FHIR `Communication` resources, ensuring healthcare compliance and data interoperability.

### UI components

UI components are built using [gluestack-ui v2](https://ui.gluestack.com/). All original components from the library are kept as-is under the `components/ui` directory, but additional components are added to the same directory to support the app's requirements. Domain-specific components are at `components` directory.

## Getting Started

### Prerequisites
- [Expo CLI](https://docs.expo.dev/)
- npm or yarn
- iOS Simulator (for iOS) or Android Emulator (for Android)

### Installation

1. Install dependencies:

    ```bash
    npm install
    ```

### Configuring Medplum OAuth2

1. Create a Medplum account and a project (in case you don't have one yet): https://app.medplum.com/register

2. Inside your Medplum project, [invite a new Patient user](https://app.medplum.com/admin/invite). Use a different email address here, because that will be your test Patient user.

3. Also, [invite a new Practitioner user](https://app.medplum.com/admin/invite). Use a different email address here, because that will be your test Practitioner user.

4. Create two Medplum Client Applications and get their client IDs:

    1. As a Medplum project admin, go to [Client Applications](https://app.medplum.com/ClientApplication) admin page
    2. Create two new client applications, one for web and one for native.
    3. Set the Redirect URI to `http://localhost:8081` for the web client and something like `exp://192.168.???.???:8081` for the native client.
        - Run `npm start` and check the "Metro waiting on" message in the terminal to get the IP address to use in the Redirect URI.
    4. Copy the client ID for both applications.

5. Copy the `.env.local.example` file to `.env.local`

    ```bash
    cp .env.local.example .env.local
    ```

6. Fill in the values in the `.env.local` file:

    ```bash
    EXPO_PUBLIC_MEDPLUM_WEB_CLIENT_ID=your_web_client_id
    EXPO_PUBLIC_MEDPLUM_NATIVE_CLIENT_ID=your_native_client_id
    ```

### Running the App

Start the development server:

```bash
npm start
```

This will open the Expo CLI where you can choose to run the app on:
- iOS Simulator
- Android Emulator
- Web browser
- Physical device using Expo Go

### Testing

Run the test suite:

```bash
npm test
```

The project uses Jest and React Native Testing Library for testing. Test files are located in the `__tests__` directory.

### Development Setup

The project uses ESLint, Prettier, and Husky for code quality and consistency. Install Husky pre-commit hooks:

```bash
npm run prepare
```

## Project Structure

- `/app` - Main application code using Expo Router for file-based routing
- `/components` - Reusable React components
- `/hooks` - Custom React hooks for business logic
- `/types` - TypeScript type definitions
- `/utils` - Utility functions
- `/__tests__` - Test files

## License

This project is licensed under the MIT License - see the `LICENSE.txt` file for details.

## Commercial Support

[![alt text](https://avatars2.githubusercontent.com/u/5529080?s=80&v=4 "Vinta Logo")](https://www.vintasoftware.com/)

This is an open-source project maintained by [Vinta Software](https://www.vinta.com.br/). We are always looking for exciting work! If you need any commercial support, feel free to get in touch: contact@vinta.com.br
