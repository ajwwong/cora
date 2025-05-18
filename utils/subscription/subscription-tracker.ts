/**
 * Utility for tracking RevenueCat initialization and subscription status in production
 */
import { MedplumClient } from "@medplum/core";
import { Communication } from "@medplum/fhirtypes";
import { Platform } from "react-native";

// Constants
const LOG_PREFIX = "📱 [RevenueCatTracker]";
const MAX_LOG_LENGTH = 5000; // Characters limit to prevent overly large logs

// Type definitions
export interface SubscriptionEvent {
  eventType: "initialization" | "error" | "status_change" | "purchase" | "restore";
  timestamp: string;
  success: boolean;
  details: Record<string, any>;
  errorMessage?: string;
}

/**
 * Track a RevenueCat-related event
 * This creates a Communication resource in Medplum with the event details
 */
export async function trackSubscriptionEvent(
  medplum: MedplumClient,
  event: SubscriptionEvent,
  patientId?: string
): Promise<void> {
  try {
    // Add additional context to the event
    const enrichedEvent = {
      ...event,
      environment: __DEV__ ? "development" : "production",
      platform: Platform.OS,
      version: Platform.Version,
      timestamp: new Date().toISOString(),
    };

    // Log locally for development builds
    if (__DEV__) {
      console.log(`${LOG_PREFIX} [${event.eventType}]`, enrichedEvent);
      // Exit early in development to avoid creating too many resources
      return;
    }
    
    // Generate a concise subject for the Communication
    const subject = `RevenueCat ${event.eventType} - ${event.success ? "Success" : "Failed"}`;
    
    // Determine who the communication is about
    let about = undefined;
    if (patientId) {
      about = {
        reference: `Patient/${patientId}`,
      };
    } else {
      try {
        const profile = medplum.getProfile();
        if (profile?.id) {
          about = {
            reference: `Patient/${profile.id}`,
          };
        }
      } catch (error) {
        // Patient reference not available, will create without 'about'
      }
    }
    
    // Convert event details to a string, handling circular references
    let eventDetails: string;
    try {
      eventDetails = JSON.stringify(enrichedEvent, (key, value) => {
        // Handle special cases like errors
        if (value instanceof Error) {
          return {
            message: value.message,
            stack: value.stack,
          };
        }
        return value;
      });
      
      // Truncate if too large
      if (eventDetails.length > MAX_LOG_LENGTH) {
        eventDetails = eventDetails.substring(0, MAX_LOG_LENGTH) + "... [truncated]";
      }
    } catch (error) {
      eventDetails = `Error serializing event: ${String(error)}`;
    }
    
    // Create the Communication resource
    const communication: Communication = {
      resourceType: "Communication",
      status: "completed",
      subject: about,
      about: about ? [about] : undefined,
      sent: new Date().toISOString(),
      payload: [
        {
          contentString: subject,
        },
        {
          contentString: eventDetails,
        },
      ],
      category: [
        {
          coding: [
            {
              system: "https://progressnotes.app/fhir/subscription-tracking",
              code: event.eventType,
              display: `RevenueCat ${event.eventType}`,
            },
          ],
        },
      ],
    };
    
    // Send to Medplum
    await medplum.createResource(communication);
  } catch (error) {
    // Fail silently in production but log in development
    if (__DEV__) {
      console.error(`${LOG_PREFIX} Failed to track event:`, error);
    }
  }
}

/**
 * Track RevenueCat initialization
 */
export async function trackInitialization(
  medplum: MedplumClient,
  success: boolean,
  details: Record<string, any> = {},
  error?: any
): Promise<void> {
  await trackSubscriptionEvent(
    medplum,
    {
      eventType: "initialization",
      timestamp: new Date().toISOString(),
      success,
      details,
      errorMessage: error ? String(error) : undefined,
    }
  );
}

/**
 * Track subscription status change
 */
export async function trackSubscriptionStatusChange(
  medplum: MedplumClient,
  isPremium: boolean,
  details: Record<string, any> = {}
): Promise<void> {
  await trackSubscriptionEvent(
    medplum,
    {
      eventType: "status_change",
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        isPremium,
        ...details,
      },
    }
  );
}

/**
 * Track RevenueCat error
 */
export async function trackError(
  medplum: MedplumClient,
  errorMessage: string,
  details: Record<string, any> = {}
): Promise<void> {
  await trackSubscriptionEvent(
    medplum,
    {
      eventType: "error",
      timestamp: new Date().toISOString(),
      success: false,
      details,
      errorMessage,
    }
  );
}