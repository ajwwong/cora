import { Patient } from "@medplum/fhirtypes";
import { useMedplum, useMedplumProfile } from "@medplum/react-hooks";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

export interface UserPreferencesContextType {
  // Audio autoplay
  isAutoplayEnabled: boolean;
  isLoadingPreference: boolean;
  toggleAutoplay: () => void;
  setAutoplayEnabled: (enabled: boolean) => void;

  // Add other user preferences here in the future
}

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export const UserPreferencesContext = createContext<UserPreferencesContextType>({
  isAutoplayEnabled: true, // Default to true
  isLoadingPreference: true,
  toggleAutoplay: () => {},
  setAutoplayEnabled: () => {},
});

export const useUserPreferences = () => useContext(UserPreferencesContext);

export function UserPreferencesProvider({ children }: UserPreferencesProviderProps) {
  const medplum = useMedplum();
  const profile = useMedplumProfile() as Patient;
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState<boolean>(true);
  const [isLoadingPreference, setIsLoadingPreference] = useState<boolean>(true);

  // Function to update autoplay preference in FHIR
  const updateAutoplaySetting = async (newValue: boolean): Promise<void> => {
    try {
      if (!profile?.id) {
        console.error("Cannot update setting: No profile ID");
        setIsAutoplayEnabled(newValue); // Still update the local state
        return;
      }

      console.log("Updating autoplay setting in FHIR to:", newValue);

      // First, read the current Patient resource
      const patient = await medplum.readResource("Patient", profile.id);

      // Filter out existing autoplay extension if it exists
      const updatedExtensions = (patient.extension || []).filter(
        (ext) =>
          ext.url !== "https://progressnotes.app/fhir/StructureDefinition/ui-autoplay-enabled",
      );

      // Add the new extension with the updated value
      updatedExtensions.push({
        url: "https://progressnotes.app/fhir/StructureDefinition/ui-autoplay-enabled",
        valueBoolean: newValue,
      });

      // Update the Patient resource
      await medplum.updateResource({
        ...patient,
        extension: updatedExtensions,
      });

      // Update local state
      setIsAutoplayEnabled(newValue);
      console.log("Successfully updated autoplay setting in FHIR");
    } catch (error) {
      console.error("Error updating autoplay setting in FHIR:", error);
      // Still update the local state so the UI reflects the user's choice
      setIsAutoplayEnabled(newValue);
    }
  };

  // Load autoplay preference from profile
  useEffect(() => {
    if (profile?.id) {
      setIsLoadingPreference(true);
      try {
        console.log("Loading autoplay preference from FHIR profile");
        // Look for the autoplay extension
        const autoplayExtension = profile.extension?.find(
          (ext) =>
            ext.url === "https://progressnotes.app/fhir/StructureDefinition/ui-autoplay-enabled",
        );

        // If extension exists and has a value, use that value
        if (autoplayExtension?.valueBoolean !== undefined) {
          console.log("Found existing autoplay preference:", autoplayExtension.valueBoolean);
          setIsAutoplayEnabled(autoplayExtension.valueBoolean);
        }
        // Otherwise, use the default (true) but also save it to the profile
        else {
          console.log("No existing autoplay preference found, setting default (true)");
          updateAutoplaySetting(true).catch(console.error);
        }
      } catch (error) {
        console.error("Error loading autoplay preference from FHIR:", error);
        // Keep the default (true)
      } finally {
        setIsLoadingPreference(false);
      }
    }
  }, [profile?.id]);

  // Log the autoplay state when it changes
  useEffect(() => {
    console.log("Autoplay state changed to:", isAutoplayEnabled);
    if (isAutoplayEnabled) {
      console.log("===============================================");
      console.log("AUTOPLAY ENABLED");
      console.log("===============================================");
    } else {
      console.log("===============================================");
      console.log("AUTOPLAY DISABLED");
      console.log("===============================================");
    }
  }, [isAutoplayEnabled]);

  // Toggle autoplay setting
  const toggleAutoplay = () => {
    const newValue = !isAutoplayEnabled;
    updateAutoplaySetting(newValue).catch((err) => {
      console.error("Error in toggleAutoplay:", err);
    });
  };

  // Explicitly set autoplay value
  const setAutoplay = (enabled: boolean) => {
    updateAutoplaySetting(enabled).catch((err) => {
      console.error("Error in setAutoplay:", err);
    });
  };

  const value = {
    isAutoplayEnabled,
    isLoadingPreference,
    toggleAutoplay,
    setAutoplayEnabled: setAutoplay,
  };

  return (
    <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
  );
}
