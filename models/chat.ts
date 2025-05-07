import { ProfileResource } from "@medplum/core";
import { Attachment, Communication, Patient, Practitioner, Reference } from "@medplum/fhirtypes";

export class ChatMessage {
  readonly originalCommunication: Communication;

  constructor({ originalCommunication }: { originalCommunication: Communication }) {
    this.originalCommunication = originalCommunication;
  }

  static fromCommunication({ comm }: { comm: Communication }): ChatMessage {
    return new ChatMessage({
      originalCommunication: comm,
    });
  }

  get id(): string {
    return this.originalCommunication.id!;
  }

  get text(): string {
    return this.originalCommunication.payload?.[0]?.contentString || "";
  }

  get attachment(): Attachment | undefined {
    // find the first attachment in the payload and return it
    for (const payload of this.originalCommunication.payload || []) {
      if (payload.contentAttachment) {
        return payload.contentAttachment;
      }
    }
    return undefined;
  }

  get senderType(): "Patient" | "Practitioner" {
    if (!this.originalCommunication.sender?.reference) {
      // Default to Practitioner if reference is missing
      return "Practitioner";
    }
    return this.originalCommunication.sender.reference.includes("Patient")
      ? "Patient"
      : "Practitioner";
  }

  get sentAt(): Date {
    return new Date(this.originalCommunication.sent!);
  }

  get messageOrder(): number {
    return new Date(
      this.originalCommunication.sent || this.originalCommunication.meta?.lastUpdated || new Date(),
    ).getTime();
  }

  get received(): Date | undefined {
    return this.originalCommunication.received
      ? new Date(this.originalCommunication.received)
      : undefined;
  }

  get read(): boolean {
    return this.originalCommunication.status === "completed";
  }

  get avatarRef(): Reference<Patient | Practitioner> | undefined {
    if (!this.originalCommunication.sender?.reference) {
      return undefined;
    }
    return this.originalCommunication.sender as Reference<Patient | Practitioner>;
  }

  // Add role property for AI compatibility
  get role(): "user" | "assistant" {
    return this.senderType === "Patient" ? "user" : "assistant";
  }

  // Add audio data accessor
  get audioData(): string | undefined {
    // Check for reflection guide extension first
    const audioExt = this.originalCommunication.extension?.find(
      (e) =>
        e.url === "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-data",
    );
    if (audioExt?.valueString) return audioExt.valueString;

    // Then check for attachment
    return this.attachment?.data;
  }

  // Add transcription placeholder detection
  get isTranscriptionPlaceholder(): boolean {
    return this.text === "[Audio message - Transcribing...]";
  }

  get audioContentType(): string | undefined {
    const typeExt = this.originalCommunication.extension?.find(
      (e) =>
        e.url ===
        "https://progressnotes.app/fhir/StructureDefinition/reflection-guide-audio-content-type",
    );
    return typeExt?.valueString || this.attachment?.contentType || "audio/wav";
  }
}

export class Thread {
  readonly messages: ChatMessage[];
  readonly originalCommunication: Communication;

  constructor({
    messages,
    originalCommunication,
  }: {
    messages: ChatMessage[];
    originalCommunication: Communication;
  }) {
    this.messages = [...messages].sort((a, b) => a.messageOrder - b.messageOrder);
    this.originalCommunication = originalCommunication;
  }

  static fromCommunication({
    comm,
    threadMessageComms,
  }: {
    comm: Communication;
    threadMessageComms: Communication[];
  }): Thread {
    return new Thread({
      messages: threadMessageComms.map((comm) => ChatMessage.fromCommunication({ comm })),
      originalCommunication: comm,
    });
  }

  get id(): string {
    return this.originalCommunication.id!;
  }

  get topic(): string {
    return this.originalCommunication.payload?.[0]?.contentString || this.id;
  }

  get lastMessage(): string | undefined {
    const lastMsg = this.messages[this.messages.length - 1];
    return lastMsg?.text;
  }

  get lastMessageSentAt(): Date | undefined {
    const lastMsg = this.messages[this.messages.length - 1];
    return lastMsg?.sentAt;
  }

  get createdAt(): Date {
    // Use the timestamp when the thread itself was created
    return new Date(
      this.originalCommunication.sent || this.originalCommunication.meta?.lastUpdated || new Date(),
    );
  }

  get threadOrder(): number {
    return new Date(
      this.lastMessageSentAt ||
        this.originalCommunication.sent ||
        this.originalCommunication.meta?.lastUpdated ||
        new Date(),
    ).getTime();
  }

  getUnreadCount({ profile }: { profile: ProfileResource }): number {
    return this.messages.filter((msg) => !msg.read && msg.senderType !== profile.resourceType)
      .length;
  }

  get lastProviderCommunication(): Communication | undefined {
    return this.messages.findLast((msg) => msg.senderType === "Practitioner")
      ?.originalCommunication;
  }

  get lastPatientCommunication(): Communication | undefined {
    return this.messages.findLast((msg) => msg.senderType === "Patient")?.originalCommunication;
  }

  get practitionerName(): string | undefined {
    if (!this.lastProviderCommunication?.sender) {
      return undefined;
    }
    return this.lastProviderCommunication.sender.display;
  }

  get practitionerRef(): Reference<Practitioner> | undefined {
    if (!this.lastProviderCommunication?.sender?.reference) {
      return undefined;
    }
    return this.lastProviderCommunication.sender as Reference<Practitioner>;
  }

  get patientName(): string | undefined {
    return this.originalCommunication.subject?.display;
  }

  get patientRef(): Reference<Patient> | undefined {
    if (!this.originalCommunication.subject?.reference) {
      return undefined;
    }
    return this.originalCommunication.subject as Reference<Patient>;
  }

  getAvatarRef({
    profile,
  }: {
    profile: ProfileResource | undefined;
  }): Reference<Patient | Practitioner> | undefined {
    if (!profile) {
      return undefined;
    }
    // If the profile is a patient, we need to get the practitioner's avatar, else get the patient's avatar
    const ref = profile.resourceType === "Patient" ? this.practitionerRef : this.patientRef;
    if (!ref?.reference) {
      return undefined;
    }
    return ref;
  }

  // Add reflection-specific properties
  get isReflectionThread(): boolean {
    return (
      this.originalCommunication.extension?.some(
        (e) => e.url === "https://progressnotes.app/fhir/StructureDefinition/reflection-thread",
      ) ?? false
    );
  }

  get reflectionTheme(): string | undefined {
    return this.originalCommunication.extension?.find(
      (e) => e.url === "https://progressnotes.app/fhir/StructureDefinition/reflection-themes",
    )?.valueString;
  }

  // For Claude messaging format
  getClaudeMessages(): { role: string; content: string }[] {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: msg.text,
    }));
  }
}
