import { getReferenceString, MedplumClient } from "@medplum/core";
import { Patient, Practitioner, Reference } from "@medplum/fhirtypes";
import { useMedplum } from "@medplum/react-hooks";
import { useCallback, useEffect, useState } from "react";

const avatarMap = new Map<string, string | null>();

// Add a special case for the reflection guide bot
const REFLECTION_GUIDE_BOT_ID = "reflection-guide-bot";
const REFLECTION_GUIDE_BOT_REFERENCE = `Practitioner/${REFLECTION_GUIDE_BOT_ID}`;

// Create a mock practitioner for the reflection guide bot
const mockReflectionGuideBot: Practitioner = {
  resourceType: "Practitioner",
  id: REFLECTION_GUIDE_BOT_ID,
  name: [
    {
      family: "Guide",
      given: ["Reflection"],
      text: "Reflection Guide",
    },
  ],
  active: true,
};

async function fetchAvatars({
  references,
  medplum,
}: {
  references: Reference<Patient | Practitioner>[];
  medplum: MedplumClient;
}) {
  return await Promise.all(
    references.map(async (reference) => {
      const key = getReferenceString(reference);
      if (avatarMap.has(key)) {
        return avatarMap.get(key);
      }

      // Special case for reflection guide bot
      if (key === REFLECTION_GUIDE_BOT_REFERENCE) {
        avatarMap.set(key, null);
        return null;
      }

      try {
        const profile = await medplum.readReference(reference);
        const avatarURL = profile.photo?.[0]?.url || null;
        avatarMap.set(key, avatarURL);
        return avatarURL;
      } catch (error) {
        console.log(`Failed to fetch avatar for ${key}:`, error);

        // Handle special case for reflection guide bot if using a different reference format
        if (key.includes("reflection-guide")) {
          avatarMap.set(key, null);
          return null;
        }

        // Cache the failure to avoid repeated failed requests
        avatarMap.set(key, null);
        return null;
      }
    }),
  );
}

function getAvatarURL(reference: Reference<Patient | Practitioner> | undefined) {
  if (!reference) {
    return undefined;
  }

  const key = getReferenceString(reference);

  // Special case for reflection guide bot
  if (key === REFLECTION_GUIDE_BOT_REFERENCE || key.includes("reflection-guide")) {
    return null;
  }

  return avatarMap.get(key);
}

export function useAvatars(references: (Reference<Patient | Practitioner> | undefined)[]): {
  getAvatarURL: (
    reference: Reference<Patient | Practitioner> | undefined,
  ) => string | null | undefined;
  isLoading: boolean;
} {
  const medplum = useMedplum();
  const [isLoading, setIsLoading] = useState(false);

  const fetchMissingAvatars = useCallback(async () => {
    const refsToFetch = references.filter((ref) => {
      if (!ref) return false;

      const key = getReferenceString(ref);
      // Skip reflection guide bot references - handle them with the special case
      if (key === REFLECTION_GUIDE_BOT_REFERENCE || key.includes("reflection-guide")) {
        avatarMap.set(key, null);
        return false;
      }

      return !avatarMap.has(key);
    });

    if (refsToFetch.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await fetchAvatars({ references: refsToFetch, medplum });
    } catch (error) {
      console.error("Error fetching avatars:", error);
    } finally {
      setIsLoading(false);
    }
  }, [references, medplum]);

  // Fetch missing avatars when references change
  useEffect(() => {
    fetchMissingAvatars();
  }, [fetchMissingAvatars]);

  return { getAvatarURL, isLoading };
}
