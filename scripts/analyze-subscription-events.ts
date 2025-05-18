/**
 * Script to analyze subscription events for a specific patient
 * Run with: npx ts-node scripts/analyze-subscription-events.ts [patientId]
 */
import { MedplumClient } from '@medplum/core';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MEDPLUM_CLIENT_ID = process.env.MEDPLUM_CLIENT_ID || '';
const MEDPLUM_CLIENT_SECRET = process.env.MEDPLUM_CLIENT_SECRET || '';
const BASE_URL = process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/';

async function main(): Promise<void> {
  // Get patient ID from command line arguments
  const patientId = process.argv[2];
  if (!patientId) {
    console.error('Please provide a patient ID as the first argument');
    process.exit(1);
  }

  console.log(`Analyzing subscription events for Patient/${patientId}...`);

  try {
    // Initialize Medplum client
    const medplum = new MedplumClient({
      baseUrl: BASE_URL,
    });

    // Authenticate with client credentials
    if (!MEDPLUM_CLIENT_ID || !MEDPLUM_CLIENT_SECRET) {
      console.error('Missing MEDPLUM_CLIENT_ID or MEDPLUM_CLIENT_SECRET environment variables');
      process.exit(1);
    }

    await medplum.startClientLogin(MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET);

    // Search for all RevenueCat related Communications for this patient
    const searchResult = await medplum.search('Communication', {
      'about': `Patient/${patientId}`,
      'category': 'https://progressnotes.app/fhir/subscription-tracking',
      '_sort': '-sent',
      '_count': '100'
    });

    if (!searchResult.entry || searchResult.entry.length === 0) {
      console.log('No subscription events found for this patient.');
      return;
    }

    console.log(`Found ${searchResult.entry.length} subscription events.`);
    console.log('-------------------------------------------');

    // Process and display each event
    searchResult.entry.forEach((entry, index) => {
      const event = entry.resource;
      if (!event) return;

      const eventType = event.payload?.[0]?.contentString || 'Unknown event';
      const eventData = event.payload?.[1]?.contentString || '{}';
      const sentDate = event.sent ? new Date(event.sent).toLocaleString() : 'Unknown date';

      console.log(`Event #${index + 1}: ${eventType}`);
      console.log(`Date: ${sentDate}`);

      try {
        // Format and display the event data as JSON
        const parsedData = JSON.parse(eventData);
        console.log('Details:');
        console.log(JSON.stringify(parsedData, null, 2));
      } catch (error) {
        console.log('Details (raw):', eventData);
      }

      console.log('-------------------------------------------');
    });

    // Check patient record for subscription extension
    const patient = await medplum.readResource('Patient', patientId);
    const subscriptionExt = patient.extension?.find(ext => 
      ext.url === 'https://progressnotes.app/fhir/StructureDefinition/subscription-status'
    );

    if (subscriptionExt && subscriptionExt.valueString) {
      console.log('Patient Subscription Extension:');
      try {
        const subscriptionData = JSON.parse(subscriptionExt.valueString);
        console.log(JSON.stringify(subscriptionData, null, 2));
      } catch (error) {
        console.log(subscriptionExt.valueString);
      }
    } else {
      console.log('No subscription extension found on patient record.');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();