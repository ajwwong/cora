import React, { createContext, ReactNode, useContext, useState } from "react";

export interface UserPreferencesContextType {
  // Audio autoplay
  isAutoplayEnabled: boolean;
  toggleAutoplay: () => void;
  setAutoplayEnabled: (enabled: boolean) => void;

  // Add other user preferences here in the future
}

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export const UserPreferencesContext = createContext<UserPreferencesContextType>({
  isAutoplayEnabled: true, // Default to true
  toggleAutoplay: () => {},
  setAutoplayEnabled: () => {},
});

export const useUserPreferences = () => useContext(UserPreferencesContext);

export function UserPreferencesProvider({ children }: UserPreferencesProviderProps) {
  // For now, we'll use a simple state without persistent storage
  // This avoids potential issues with AsyncStorage in this environment
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState<boolean>(true);

  // Log the initial autoplay state when the provider mounts
  React.useEffect(() => {
    console.log("UserPreferencesProvider mounted with autoplay:", isAutoplayEnabled);
    console.log("Using SecureHealth's simpler autoplay model - only global on/off control");
    if (isAutoplayEnabled) {
      console.log("AUTOPLAY ENABLED BY DEFAULT");
    }
  }, [isAutoplayEnabled]);

  // Toggle autoplay setting
  const toggleAutoplay = () => {
    const newValue = !isAutoplayEnabled;
    setIsAutoplayEnabled(newValue);
    console.log(`Autoplay ${newValue ? "enabled" : "disabled"}`);

    // Log to make it more visible in the console
    if (newValue) {
      console.log("===============================================");
      console.log("AUTOPLAY ENABLED");
      console.log("===============================================");
    } else {
      console.log("===============================================");
      console.log("AUTOPLAY DISABLED");
      console.log("===============================================");
    }
  };

  // Explicitly set autoplay value
  const setAutoplay = (enabled: boolean) => {
    setIsAutoplayEnabled(enabled);
    console.log(`Autoplay set to ${enabled}`);

    // Log to make it more visible in the console
    if (enabled) {
      console.log("===============================================");
      console.log("AUTOPLAY ENABLED");
      console.log("===============================================");
    } else {
      console.log("===============================================");
      console.log("AUTOPLAY DISABLED");
      console.log("===============================================");
    }
  };

  const value = {
    isAutoplayEnabled,
    toggleAutoplay,
    setAutoplayEnabled: setAutoplay,
  };

  return (
    <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
  );
}
