import { MedplumClient } from "@medplum/core";
import { Extension, Patient } from "@medplum/fhirtypes";
import { format } from "date-fns";

// Extension URLs for the voice message tracking feature
const VOICE_MESSAGE_EXTENSION_BASE = "https://progressnotes.app/fhir/StructureDefinition";
export const DAILY_VOICE_COUNT_EXTENSION = `${VOICE_MESSAGE_EXTENSION_BASE}/daily-voice-message-count`;
export const MONTHLY_VOICE_COUNT_EXTENSION = `${VOICE_MESSAGE_EXTENSION_BASE}/monthly-voice-message-count`;
export const LAST_COUNT_RESET_DATE_EXTENSION = `${VOICE_MESSAGE_EXTENSION_BASE}/last-voice-count-reset-date`;

// Maximum number of voice messages allowed for free tier
export const FREE_DAILY_VOICE_MESSAGE_LIMIT = 10;

/**
 * Data structure for voice message usage
 */
export interface VoiceMessageUsage {
  dailyCount: number;
  monthlyCount: number;
  lastResetDate: string;
}

/**
 * Gets current voice message usage from the patient resource
 * @param medplum Medplum client instance
 * @param patientId Patient ID
 * @returns Voice message usage data
 */
export async function getVoiceMessageUsage(
  medplum: MedplumClient,
  patientId: string,
): Promise<VoiceMessageUsage> {
  try {
    console.log(`📱 [voiceTracking] Getting voice message usage for patient: ${patientId}`);

    // Get the patient resource
    const patient = await medplum.readResource("Patient", patientId);

    // If the patient doesn't have extensions, initialize with default values
    if (!patient.extension || patient.extension.length === 0) {
      return {
        dailyCount: 0,
        monthlyCount: 0,
        lastResetDate: new Date().toISOString(),
      };
    }

    // Find the voice message count extensions
    const dailyCountExt = patient.extension.find((ext) => ext.url === DAILY_VOICE_COUNT_EXTENSION);
    const monthlyCountExt = patient.extension.find(
      (ext) => ext.url === MONTHLY_VOICE_COUNT_EXTENSION,
    );
    const lastResetDateExt = patient.extension.find(
      (ext) => ext.url === LAST_COUNT_RESET_DATE_EXTENSION,
    );

    // Parse the values (default to 0 for counts and current date for reset date)
    const dailyCount = dailyCountExt?.valueInteger || 0;
    const monthlyCount = monthlyCountExt?.valueInteger || 0;
    const lastResetDate = lastResetDateExt?.valueDateTime || new Date().toISOString();

    console.log(
      `📱 [voiceTracking] Current usage - daily: ${dailyCount}, monthly: ${monthlyCount}, last reset: ${lastResetDate}`,
    );

    // Return the voice message usage
    return {
      dailyCount,
      monthlyCount,
      lastResetDate,
    };
  } catch (error) {
    console.error("Error getting voice message usage:", error);
    // Return default values in case of error
    return {
      dailyCount: 0,
      monthlyCount: 0,
      lastResetDate: new Date().toISOString(),
    };
  }
}

/**
 * Updates the voice message count for a patient
 * @param medplum Medplum client instance
 * @param patientId Patient ID
 * @returns Updated voice message usage
 */
export async function incrementVoiceMessageCount(
  medplum: MedplumClient,
  patientId: string,
): Promise<VoiceMessageUsage> {
  try {
    console.log(`📱 [voiceTracking] Incrementing voice message count for patient: ${patientId}`);

    // Get the patient resource
    const patient = await medplum.readResource("Patient", patientId);

    // Get current usage
    const currentUsage = await getVoiceMessageUsage(medplum, patientId);

    // Check if we need to reset daily count (if date has changed)
    const resetNeeded = shouldResetCount(currentUsage.lastResetDate);

    // If date has changed, reset the daily count
    const newDailyCount = resetNeeded ? 1 : currentUsage.dailyCount + 1;

    // Determine if we need to reset monthly count
    const today = new Date();
    const lastResetDate = new Date(currentUsage.lastResetDate);
    const resetMonthly =
      lastResetDate.getMonth() !== today.getMonth() ||
      lastResetDate.getFullYear() !== today.getFullYear();

    // Increment the monthly count
    const newMonthlyCount = resetMonthly ? 1 : currentUsage.monthlyCount + 1;

    // Current date and time
    const now = new Date();
    const today_iso = now.toISOString();

    // Create the extensions
    const extensions: Extension[] = [
      ...(patient.extension || []).filter(
        (ext) =>
          ext.url !== DAILY_VOICE_COUNT_EXTENSION &&
          ext.url !== MONTHLY_VOICE_COUNT_EXTENSION &&
          ext.url !== LAST_COUNT_RESET_DATE_EXTENSION,
      ),
      { url: DAILY_VOICE_COUNT_EXTENSION, valueInteger: newDailyCount },
      { url: MONTHLY_VOICE_COUNT_EXTENSION, valueInteger: newMonthlyCount },
      { url: LAST_COUNT_RESET_DATE_EXTENSION, valueDateTime: today_iso },
    ];

    // Update the patient resource
    const updatedPatient: Patient = {
      ...patient,
      extension: extensions,
    };

    // Save the updated patient
    await medplum.updateResource(updatedPatient);

    console.log(
      `📱 [voiceTracking] Updated counts - daily: ${newDailyCount}, monthly: ${newMonthlyCount}, reset: ${today_iso}`,
    );

    // Return the updated usage
    return {
      dailyCount: newDailyCount,
      monthlyCount: newMonthlyCount,
      lastResetDate: today_iso,
    };
  } catch (error) {
    console.error("Error updating voice message count:", error);
    throw error;
  }
}

/**
 * Resets the daily count for a patient
 * @param medplum Medplum client instance
 * @param patientId Patient ID
 * @returns Updated voice message usage
 */
export async function resetDailyVoiceMessageCount(
  medplum: MedplumClient,
  patientId: string,
): Promise<VoiceMessageUsage> {
  try {
    console.log(`📱 [voiceTracking] Resetting daily voice message count for patient: ${patientId}`);

    // Get the patient resource
    const patient = await medplum.readResource("Patient", patientId);

    // Get current usage
    const currentUsage = await getVoiceMessageUsage(medplum, patientId);

    // Current date and time
    const now = new Date();

    // Create the extensions
    const extensions: Extension[] = [
      ...(patient.extension || []).filter(
        (ext) =>
          ext.url !== DAILY_VOICE_COUNT_EXTENSION && ext.url !== LAST_COUNT_RESET_DATE_EXTENSION,
      ),
      { url: DAILY_VOICE_COUNT_EXTENSION, valueInteger: 0 },
      { url: MONTHLY_VOICE_COUNT_EXTENSION, valueInteger: currentUsage.monthlyCount },
      { url: LAST_COUNT_RESET_DATE_EXTENSION, valueDateTime: now.toISOString() },
    ];

    // Update the patient resource
    const updatedPatient: Patient = {
      ...patient,
      extension: extensions,
    };

    // Save the updated patient
    await medplum.updateResource(updatedPatient);

    console.log(`📱 [voiceTracking] Reset daily count to 0, monthly: ${currentUsage.monthlyCount}`);

    // Return the updated usage
    return {
      dailyCount: 0,
      monthlyCount: currentUsage.monthlyCount,
      lastResetDate: now.toISOString(),
    };
  } catch (error) {
    console.error("Error resetting voice message count:", error);
    throw error;
  }
}

/**
 * Checks if daily count should be reset based on the last reset date
 * @param lastResetDate Last reset date in ISO format
 * @returns True if count should be reset, false otherwise
 */
function shouldResetCount(lastResetDate: string): boolean {
  try {
    const today = new Date();
    const lastReset = new Date(lastResetDate);

    // Check if the dates are different
    return format(today, "yyyy-MM-dd") !== format(lastReset, "yyyy-MM-dd");
  } catch (error) {
    console.error("Error checking if count should be reset:", error);
    return false;
  }
}

/**
 * Checks if user has reached free tier daily limit
 * @param dailyCount Current daily count
 * @returns True if limit reached, false otherwise
 */
export function hasReachedDailyLimit(dailyCount: number): boolean {
  return dailyCount >= FREE_DAILY_VOICE_MESSAGE_LIMIT;
}
