/**
 * System logging utility using AuditEvent resources
 *
 * This utility provides structured logging for system events (subscription tracking,
 * bot executions, errors, etc.) using FHIR AuditEvent resources instead of
 * Communication resources to prevent them from appearing in chat threads.
 */
import { MedplumClient } from "@medplum/core";
import { AuditEvent, Reference } from "@medplum/fhirtypes";
import { Platform } from "react-native";

// Constants
const LOG_PREFIX = "🔍 [SystemLogger]";
const MAX_LOG_LENGTH = 5000; // Characters limit to prevent overly large logs

// Type definitions
export interface SystemLogEvent {
  eventType: "subscription" | "bot_execution" | "error" | "user_action" | "system_event";
  action: "create" | "read" | "update" | "delete" | "execute" | "login" | "logout";
  outcome: "success" | "error" | "warning" | "info";
  entity?: string; // Bot ID, Patient ID, etc.
  message: string;
  details?: Record<string, unknown>;
  patientId?: string;
}

/**
 * Create a system log entry using AuditEvent
 */
export async function createSystemLog(
  medplum: MedplumClient,
  event: SystemLogEvent,
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
      console.log(`${LOG_PREFIX} [${event.eventType}/${event.action}]`, enrichedEvent);
      // Exit early in development to avoid creating too many resources
      return;
    }

    // Determine patient reference if available
    let patientRef: Reference | undefined;
    if (event.patientId) {
      patientRef = { reference: `Patient/${event.patientId}` };
    } else {
      try {
        const profile = medplum.getProfile();
        if (profile?.id && profile.resourceType === "Patient") {
          patientRef = { reference: `Patient/${profile.id}` };
        }
      } catch (error) {
        // Patient reference not available
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

    // Map our action types to FHIR AuditEvent action codes
    const actionCode =
      event.action === "create"
        ? "C"
        : event.action === "read"
          ? "R"
          : event.action === "update"
            ? "U"
            : event.action === "delete"
              ? "D"
              : event.action === "execute"
                ? "E"
                : event.action === "login"
                  ? "C"
                  : event.action === "logout"
                    ? "D"
                    : "E";

    // Map our outcome types to FHIR AuditEvent outcome codes
    const outcomeCode =
      event.outcome === "success"
        ? "0"
        : event.outcome === "error"
          ? "4"
          : event.outcome === "warning"
            ? "8"
            : "0";

    // Create the AuditEvent resource
    const auditEvent: AuditEvent = {
      resourceType: "AuditEvent",
      type: {
        system: "https://progressnotes.app/audit-event-types",
        code: event.eventType,
        display: event.eventType.replace("_", " "),
      },
      subtype: [
        {
          system: "https://progressnotes.app/audit-event-subtypes",
          code: event.action,
          display: event.action,
        },
      ],
      action: actionCode,
      recorded: new Date().toISOString(),
      outcome: outcomeCode,
      outcomeDesc: event.message,
      agent: [
        {
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/extra-security-role-type",
                code: "application",
                display: "Application",
              },
            ],
          },
          who: {
            display: "Cora Mobile App",
          },
          requestor: false as boolean,
        },
      ],
      source: {
        site: Platform.OS,
        observer: {
          display: `Cora App (${Platform.OS})`,
        },
        type: [
          {
            system: "http://terminology.hl7.org/CodeSystem/security-source-type",
            code: "4", // Application Server
            display: "Application Server",
          },
        ],
      },
      entity: [],
    };

    // Add patient entity if available
    if (patientRef) {
      auditEvent.entity!.push({
        what: patientRef,
        type: {
          system: "http://terminology.hl7.org/CodeSystem/audit-entity-type",
          code: "1", // Person
          display: "Person",
        },
        role: {
          system: "http://terminology.hl7.org/CodeSystem/object-role",
          code: "1", // Patient
          display: "Patient",
        },
      });
    }

    // Add entity reference if provided
    if (event.entity) {
      auditEvent.entity!.push({
        what: { reference: event.entity },
        type: {
          system: "http://terminology.hl7.org/CodeSystem/audit-entity-type",
          code: "2", // System Object
          display: "System Object",
        },
      });
    }

    // Add event details as entity detail
    if (eventDetails) {
      auditEvent.entity!.push({
        detail: [
          {
            type: "event-details",
            valueString: eventDetails,
          },
        ],
        type: {
          system: "http://terminology.hl7.org/CodeSystem/audit-entity-type",
          code: "4", // Other
          display: "Other",
        },
      });
    }

    // Create the AuditEvent resource
    await medplum.createResource(auditEvent);
  } catch (error) {
    // Fail silently in production but log in development
    if (__DEV__) {
      console.error(`${LOG_PREFIX} Failed to create system log:`, error);
    }
  }
}

/**
 * Track subscription-related events
 */
export async function trackSubscriptionEvent(
  medplum: MedplumClient,
  eventType: "initialization" | "error" | "status_change" | "purchase" | "restore",
  success: boolean,
  details: Record<string, unknown> = {},
  error?: unknown,
  patientId?: string,
): Promise<void> {
  await createSystemLog(medplum, {
    eventType: "subscription",
    action:
      eventType === "initialization"
        ? "create"
        : eventType === "purchase"
          ? "create"
          : eventType === "restore"
            ? "read"
            : eventType === "status_change"
              ? "update"
              : "execute",
    outcome: success ? "success" : "error",
    message: `RevenueCat ${eventType} - ${success ? "Success" : "Failed"}${error ? `: ${String(error)}` : ""}`,
    details,
    patientId,
  });
}

/**
 * Track bot execution events
 */
export async function trackBotExecution(
  medplum: MedplumClient,
  botId: string,
  success: boolean,
  details: Record<string, unknown> = {},
  error?: unknown,
  patientId?: string,
): Promise<void> {
  await createSystemLog(medplum, {
    eventType: "bot_execution",
    action: "execute",
    outcome: success ? "success" : "error",
    entity: `Bot/${botId}`,
    message: `Bot execution ${success ? "completed" : "failed"}${error ? `: ${String(error)}` : ""}`,
    details,
    patientId,
  });
}

/**
 * Track user actions
 */
export async function trackUserAction(
  medplum: MedplumClient,
  action: "login" | "logout" | "create" | "update" | "delete",
  entityType: string,
  success: boolean = true,
  details: Record<string, unknown> = {},
  patientId?: string,
): Promise<void> {
  await createSystemLog(medplum, {
    eventType: "user_action",
    action,
    outcome: success ? "success" : "error",
    message: `User ${action} ${entityType}`,
    details,
    patientId,
  });
}

/**
 * Track system errors
 */
export async function trackSystemError(
  medplum: MedplumClient,
  errorMessage: string,
  details: Record<string, unknown> = {},
  patientId?: string,
): Promise<void> {
  await createSystemLog(medplum, {
    eventType: "error",
    action: "execute",
    outcome: "error",
    message: errorMessage,
    details,
    patientId,
  });
}
