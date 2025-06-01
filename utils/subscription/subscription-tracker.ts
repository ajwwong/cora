/**
 * Utility for tracking RevenueCat initialization and subscription status in production
 *
 * This module has been updated to use AuditEvent resources instead of Communication
 * resources to prevent subscription events from appearing in chat threads.
 */
import { MedplumClient } from "@medplum/core";

import { trackSubscriptionEvent } from "@/utils/system-logging";

// Constants (kept for potential future use)
// const LOG_PREFIX = "📱 [RevenueCatTracker]";

// Type definitions (kept for backward compatibility)
export interface SubscriptionEvent {
  eventType: "initialization" | "error" | "status_change" | "purchase" | "restore";
  timestamp: string;
  success: boolean;
  details: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Track a RevenueCat-related event
 * This creates an AuditEvent resource in Medplum with the event details
 * (Updated to use AuditEvent instead of Communication to prevent appearing in chat threads)
 */
export async function trackSubscriptionEventLegacy(
  medplum: MedplumClient,
  event: SubscriptionEvent,
  patientId?: string,
): Promise<void> {
  // Use the new system logging utility
  await trackSubscriptionEvent(
    medplum,
    event.eventType,
    event.success,
    event.details,
    event.errorMessage,
    patientId,
  );
}

/**
 * Track RevenueCat initialization
 */
export async function trackInitialization(
  medplum: MedplumClient,
  success: boolean,
  details: Record<string, unknown> = {},
  error?: unknown,
): Promise<void> {
  await trackSubscriptionEvent(medplum, "initialization", success, details, error);
}

/**
 * Track subscription status change
 */
export async function trackSubscriptionStatusChange(
  medplum: MedplumClient,
  isPremium: boolean,
  details: Record<string, unknown> = {},
): Promise<void> {
  await trackSubscriptionEvent(medplum, "status_change", true, {
    isPremium,
    ...details,
  });
}

/**
 * Track RevenueCat error
 */
export async function trackError(
  medplum: MedplumClient,
  errorMessage: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await trackSubscriptionEvent(medplum, "error", false, details, errorMessage);
}
