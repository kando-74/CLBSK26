import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const libraryCollection = db.collection("libraryEntries");
const activityCollection = db.collection("activityLogs");
const authorizedEmailsCollection = db.collection("authorizedEmails");
const boardTablesCollection = db.collection("boardTables");

import { onDocumentUpdated } from "firebase-functions/v2/firestore";

// ... (existing code) ...

export const onUserAliasUpdate = onDocumentUpdated("users/{userId}", async (event) => {
  const aliasBefore = event.data?.before.data().alias as string | undefined;
  const aliasAfter = event.data?.after.data().alias as string | undefined;

  if (aliasBefore === aliasAfter) {
    logger.info(`Alias for ${event.params.userId} not changed. Exiting.`);
    return;
  }

  const newAlias = aliasAfter?.trim();
  if (!newAlias) {
    logger.info(`New alias for ${event.params.userId} is empty. Exiting.`);
    return;
  }

  logger.info(`Alias for ${event.params.userId} changed from "${aliasBefore ?? ""}" to "${newAlias}". Propagating to tables.`);

  const userId = event.params.userId;
  const batch = db.batch();
  let tablesUpdated = 0;

  try {
    const tablesSnapshot = await boardTablesCollection.get();

    tablesSnapshot.forEach((doc) => {
      const table = doc.data();
      const participants = table.participants as { uid: string; name: string }[] | undefined;

      if (!participants || !Array.isArray(participants)) {
        return;
      }

      let needsUpdate = false;
      const updatedParticipants = participants.map((participant) => {
        if (participant.uid === userId && participant.name !== newAlias) {
          needsUpdate = true;
          return { ...participant, name: newAlias };
        }
        return participant;
      });

      if (needsUpdate) {
        batch.update(doc.ref, { participants: updatedParticipants });
        tablesUpdated++;
      }
    });

    if (tablesUpdated > 0) {
      await batch.commit();
      logger.info(`Successfully updated alias in ${tablesUpdated} tables for user ${userId}.`);
    } else {
      logger.info(`No tables found to update for user ${userId}.`);
    }
  } catch (error) {
    logger.error(`Error propagating alias for user ${userId}:`, error);
    throw new HttpsError("internal", "Failed to update user alias in tables.");
  }
});


type WhitelistRole = "asistente" | "staff" | "organizacion";
type WhitelistStatus = "approved" | "pending" | "revoked";

type AddLibraryEntryPayload = {
  eventId?: string;
  language?: string;
  bggId?: number | null;
  manualTitle?: string | null;
  bggData?: {
    name?: string | null;
    thumbnail?: string | null;
    imageUrl?: string | null;
    yearPublished?: number | null;
  } | null;
  entry?: LibraryEntryPayload;
};

type LibraryEntryPayload = {
  id?: string;
  title?: string;
  owner?: string;
  ownerId?: string | null;
  ownerEmail?: string | null;
  players?: string;
  duration?: string;
  weight?: string;
  language?: string;
  mechanics?: unknown;
  coverUrl?: string | null;
  bggId?: number | null;
  manual?: boolean;
  eventId?: string | null;
  yearPublished?: number | null;
  durationMinutes?: number | null;
  weightValue?: number | null;
};

type LibraryEntryRecord = {
  id: string;
  title: string;
  owner: string;
  ownerId: string | null;
  ownerEmail: string | null;
  players: string;
  duration: string;
  weight: string;
  language: string;
  mechanics: string[];
  coverUrl: string | null;
  manual: boolean;
  bggId: number | null;
  eventId: string | null;
  yearPublished: number | null;
  durationMinutes: number | null;
  weightValue: number | null;
  createdAt: admin.firestore.Timestamp | null;
  updatedAt: admin.firestore.Timestamp | null;
};

type LibraryActionResponse =
  | { status: "success"; entry: LibraryEntryRecord }
  | { status: "already-exists"; entry: LibraryEntryRecord }
  | { status: "error"; message: string };

type CheckWhitelistPayload = {
  email?: string;
};

type CheckWhitelistResponse = {
  allowed: boolean;
  entry?: Record<string, unknown>;
};

type AddAuthorizedEmailPayload = {
  email?: string;
  role?: string;
};

type AddAuthorizedEmailResponse = {
  status: "success";
  entry: {
    email: string;
    role: WhitelistRole;
    status: WhitelistStatus;
    invitedBy: string | null;
    displayName: string | null;
    notes: string | null;
    updatedAt: admin.firestore.Timestamp | null;
  };
};

type UpdateAuthorizedEmailPayload = {
  email?: string;
  status?: string | null;
};

type UpdateAuthorizedEmailResponse = {
  status: "success";
  entry: {
    email: string;
    role: WhitelistRole;
    status: WhitelistStatus;
    invitedBy: string | null;
    displayName: string | null;
    notes: string | null;
    updatedAt: admin.firestore.Timestamp | null;
  };
};

function sanitizeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
}

function coerceMechanics(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 16);
}

function optionalString(value: unknown): string | null {
  const sanitized = sanitizeString(value, "");
  return sanitized.length > 0 ? sanitized : null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().replace(',', '.');
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sanitizeEmail(value: unknown): string {
  return sanitizeString(value, "").toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeWhitelistRole(value: unknown): WhitelistRole {
  if (value === "staff" || value === "organizacion") {
    return value;
  }
  return "asistente";
}

function normalizeWhitelistStatus(value: unknown): WhitelistStatus {
  if (value === "pending" || value === "revoked") {
    return value;
  }
  return "approved";
}

async function readAuthorizedEmailEntry(email: string): Promise<UpdateAuthorizedEmailResponse["entry"]> {
  const snapshot = await authorizedEmailsCollection.doc(email).get();
  const data = snapshot.data() ?? {};

  return {
    email,
    role: normalizeWhitelistRole(data.role),
    status: normalizeWhitelistStatus(data.status),
    invitedBy: optionalString(data.invitedBy ?? null),
    displayName: optionalString(data.displayName ?? null),
    notes: optionalString(data.notes ?? null),
    updatedAt: toTimestamp(data.updatedAt ?? null),
  };
}

function resolveOwnerName(request: CallableRequest<AddLibraryEntryPayload>): string {
  const entryOwner = sanitizeString(request.data?.entry?.owner);
  if (entryOwner) {
    return entryOwner;
  }

  const manualOwner = sanitizeString(request.data?.entry?.ownerEmail);
  if (manualOwner) {
    return manualOwner;
  }

  const authName = sanitizeString(request.auth?.token?.name);
  if (authName) {
    return authName;
  }

  const authEmail = sanitizeString(request.auth?.token?.email);
  if (authEmail) {
    return authEmail;
  }

  return "Participante";
}

function resolveOwnerEmail(request: CallableRequest<AddLibraryEntryPayload>): string | null {
  const entryOwnerEmail = optionalString(request.data?.entry?.ownerEmail ?? null);
  if (entryOwnerEmail) {
    return entryOwnerEmail;
  }

  return optionalString(request.auth?.token?.email ?? null);
}

function toTimestamp(value: unknown): admin.firestore.Timestamp | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value;
  }

  return null;
}

function buildLibraryEntry(
  request: CallableRequest<AddLibraryEntryPayload>,
  id: string,
): LibraryEntryRecord {
  const providedEntry = request.data?.entry;
  const language = sanitizeString(providedEntry?.language ?? request.data?.language, "N/D");
  const mechanics = providedEntry?.mechanics ?? [];

  const manualTitle = sanitizeString(request.data?.manualTitle, "");
  const bggData = request.data?.bggData ?? null;
  const titleFromBgg = sanitizeString(bggData?.name, "");
  const resolvedTitle = sanitizeString(providedEntry?.title ?? manualTitle ?? titleFromBgg, "Juego sin titulo");

  const yearPublishedFromEntry =
    typeof providedEntry?.yearPublished === "number" ? providedEntry.yearPublished : null;
  const yearPublishedFromBgg =
    typeof bggData?.yearPublished === "number" ? bggData.yearPublished : null;
  const yearPublished = yearPublishedFromEntry ?? yearPublishedFromBgg;

  const durationMinutes = coerceNumber(providedEntry?.durationMinutes ?? null);
  const weightValue = coerceNumber(providedEntry?.weightValue ?? null);

  const coverFromInput = providedEntry?.coverUrl ?? null;
  const coverFromBgg = bggData?.imageUrl ?? bggData?.thumbnail ?? null;
  const preferredCover = coverFromInput ?? coverFromBgg ?? null;
  const normalizedCover = optionalString(preferredCover);

  const providedOwnerId = optionalString(providedEntry?.ownerId ?? null);
  const ownerId = providedOwnerId ?? request.auth?.uid ?? null;

  const eventIdCandidate = optionalString(providedEntry?.eventId ?? request.data?.eventId ?? null);

  const nowTimestamp = admin.firestore.Timestamp.now();

  return {
    id,
    title: resolvedTitle,
    owner: resolveOwnerName(request),
    ownerId,
    ownerEmail: resolveOwnerEmail(request),
    players: sanitizeString(providedEntry?.players, "N/D"),
    duration: sanitizeString(providedEntry?.duration, "N/D"),
    weight: sanitizeString(providedEntry?.weight, "N/D"),
    language,
    mechanics: coerceMechanics(mechanics),
    coverUrl: normalizedCover,
    manual:
      typeof providedEntry?.manual === "boolean"
        ? providedEntry.manual
        : Boolean(manualTitle || !request.data?.bggId),
    bggId:
      typeof providedEntry?.bggId === "number"
        ? providedEntry.bggId
        : typeof request.data?.bggId === "number"
          ? request.data.bggId
          : null,
    eventId: eventIdCandidate,
    yearPublished,
    durationMinutes,
    weightValue,
    createdAt: nowTimestamp,
    updatedAt: nowTimestamp,
  };
}

function mapFirestoreEntry(
  id: string,
  data: FirebaseFirestore.DocumentData,
): LibraryEntryRecord {
  const cover = optionalString(data.coverUrl ?? null);
  const ownerId = optionalString(data.ownerId ?? null);
  const ownerEmail = optionalString(data.ownerEmail ?? null);
  const eventId = optionalString(data.eventId ?? null);

  return {
    id,
    title: sanitizeString(data.title, "Juego sin titulo"),
    owner: sanitizeString(data.owner, "Participante"),
    ownerId,
    ownerEmail,
    players: sanitizeString(data.players, "N/D"),
    duration: sanitizeString(data.duration, "N/D"),
    weight: sanitizeString(data.weight, "N/D"),
    language: sanitizeString(data.language, "N/D"),
    mechanics: coerceMechanics(data.mechanics),
    coverUrl: cover,
    manual: Boolean(data.manual),
    bggId: typeof data.bggId === "number" ? data.bggId : null,
    eventId,
    yearPublished: typeof data.yearPublished === "number" ? data.yearPublished : null,
    durationMinutes: typeof data.durationMinutes === "number" ? data.durationMinutes : null,
    weightValue: typeof data.weightValue === "number" ? data.weightValue : coerceNumber(data.weightValue ?? null),
    createdAt: toTimestamp(data.createdAt ?? null),
    updatedAt: toTimestamp(data.updatedAt ?? null),
  };
}

async function logLibraryActivity(entry: LibraryEntryRecord, actorEmail: string | null) {
  try {
    await activityCollection.add({
      type: "library:add",
      entityId: entry.id,
      entityName: entry.title,
      message: null,
      metadata: {
        manual: entry.manual,
        owner: entry.owner,
        bggId: entry.bggId ?? null,
      },
      actor: actorEmail
        ? {
          uid: null,
          email: actorEmail,
          displayName: entry.owner,
        }
        : null,
      deviceId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.warn("No se pudo registrar la actividad de la ludoteca", error);
  }
}

export const checkWhitelist = onCall(async (request: CallableRequest<CheckWhitelistPayload>) => {
  const email = sanitizeString(request.data?.email, "").toLowerCase();
  if (!email) {
    throw new HttpsError("invalid-argument", "Debes proporcionar un correo electronico valido.");
  }

  try {
    const document = await authorizedEmailsCollection.doc(email).get();
    if (!document.exists) {
      return { allowed: false } satisfies CheckWhitelistResponse;
    }

    const entry = (document.data() ?? {}) as Record<string, unknown>;
    return { allowed: true, entry } satisfies CheckWhitelistResponse;
  } catch (error) {
    logger.error("Error verificando whitelist", error);
    throw new HttpsError("internal", "No se pudo verificar el acceso en este momento.");
  }
});

export const addAuthorizedEmail = onCall(async (request: CallableRequest<AddAuthorizedEmailPayload>) => {
  const actorEmail = sanitizeEmail(request.auth?.token?.email ?? null);
  if (!actorEmail) {
    throw new HttpsError("permission-denied", "Debes iniciar sesion para gestionar la whitelist.");
  }

  try {
    const actorSnapshot = await authorizedEmailsCollection.doc(actorEmail).get();
    const actorRole = sanitizeString(actorSnapshot.data()?.role, "");

    if (actorRole !== "organizacion") {
      throw new HttpsError("permission-denied", "No tienes permisos para modificar la whitelist.");
    }

    const email = sanitizeEmail(request.data?.email ?? null);
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new HttpsError("invalid-argument", "Debes proporcionar un correo electronico valido.");
    }

    const role = normalizeWhitelistRole(request.data?.role ?? null);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    const documentRef = authorizedEmailsCollection.doc(email);
    const existingSnapshot = await documentRef.get();

    if (!existingSnapshot.exists) {
      await documentRef.set({
        email,
        role,
        status: "approved",
        invitedBy: actorEmail,
        displayName: null,
        notes: null,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });

      const entry = await readAuthorizedEmailEntry(email);
      return {
        status: "success",
        entry,
      } satisfies AddAuthorizedEmailResponse;
    }

    const existingData = existingSnapshot.data() ?? {};
    const status = normalizeWhitelistStatus(existingData.status);
    const invitedBy = optionalString(existingData.invitedBy ?? actorEmail);
    const displayName = optionalString(existingData.displayName ?? null);
    const notes = optionalString(existingData.notes ?? null);

    await documentRef.set(
      {
        email,
        role,
        status,
        invitedBy,
        displayName,
        notes,
        updatedAt: serverTimestamp,
      },
      { merge: true },
    );

    const entry = await readAuthorizedEmailEntry(email);
    return {
      status: "success",
      entry,
    } satisfies AddAuthorizedEmailResponse;
  } catch (error) {
    logger.error("Error al actualizar la whitelist", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "No se pudo actualizar la whitelist.");
  }
});

export const updateAuthorizedEmail = onCall(async (request: CallableRequest<UpdateAuthorizedEmailPayload>) => {
  const actorEmail = sanitizeEmail(request.auth?.token?.email ?? null);
  if (!actorEmail) {
    throw new HttpsError("permission-denied", "Debes iniciar sesion para gestionar la whitelist.");
  }

  try {
    const actorSnapshot = await authorizedEmailsCollection.doc(actorEmail).get();
    const actorRole = sanitizeString(actorSnapshot.data()?.role, "");

    if (actorRole !== "organizacion") {
      throw new HttpsError("permission-denied", "No tienes permisos para modificar la whitelist.");
    }

    const email = sanitizeEmail(request.data?.email ?? null);
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new HttpsError("invalid-argument", "Debes proporcionar un correo electronico valido.");
    }

    const documentRef = authorizedEmailsCollection.doc(email);
    const existingSnapshot = await documentRef.get();

    if (!existingSnapshot.exists) {
      throw new HttpsError("not-found", "El correo indicado no forma parte de la whitelist.");
    }

    const desiredStatus =
      typeof request.data?.status === "string"
        ? normalizeWhitelistStatus(request.data.status)
        : normalizeWhitelistStatus(existingSnapshot.data()?.status);

    await documentRef.set(
      {
        status: desiredStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const entry = await readAuthorizedEmailEntry(email);
    return {
      status: "success",
      entry,
    } satisfies UpdateAuthorizedEmailResponse;
  } catch (error) {
    logger.error("Error al modificar una entrada de la whitelist", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "No se pudo actualizar la whitelist.");
  }
});

export const addLibraryEntry = onCall(async (request: CallableRequest<AddLibraryEntryPayload>) => {
  logger.info('addLibraryEntry invoked', {
    hasAuth: Boolean(request.auth?.uid),
    payloadKeys: Object.keys(request.data ?? {}),
  });
  const payload = request.data ?? {};

  const title = sanitizeString(payload.entry?.title ?? payload.manualTitle ?? payload.bggData?.name, "");
  if (!title && typeof payload.bggId !== "number") {
    throw new HttpsError("invalid-argument", "Debes proporcionar un titulo o un identificador de BGG.");
  }

  const desiredId = sanitizeString(payload.entry?.id, "") || (payload.bggId ? `bgg-${payload.bggId}` : "");
  const entryId = desiredId || `manual-${Date.now()}`;

  try {
    const existingDoc = await libraryCollection.doc(entryId).get();
    if (existingDoc.exists) {
      const existingEntry = mapFirestoreEntry(entryId, existingDoc.data() ?? {});
      return { status: "already-exists", entry: existingEntry } satisfies LibraryActionResponse;
    }

    if (typeof payload.bggId === "number") {
      const existingByBgg = await libraryCollection
        .where("bggId", "==", payload.bggId)
        .limit(1)
        .get();

      if (!existingByBgg.empty) {
        const doc = existingByBgg.docs[0];
        return { status: "already-exists", entry: mapFirestoreEntry(doc.id, doc.data()) } satisfies LibraryActionResponse;
      }
    }

    const entry = buildLibraryEntry(request, entryId);

    await libraryCollection.doc(entryId).set({
      title: entry.title,
      titleLower: entry.title.toLowerCase(),
      owner: entry.owner,
      ownerId: entry.ownerId,
      ownerEmail: entry.ownerEmail,
      players: entry.players,
      duration: entry.duration,
      weight: entry.weight,
      language: entry.language,
      mechanics: entry.mechanics,
      coverUrl: entry.coverUrl,
      manual: entry.manual,
      bggId: entry.bggId,
      eventId: entry.eventId,
      yearPublished: entry.yearPublished,
      durationMinutes: entry.durationMinutes,
      weightValue: entry.weightValue,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logLibraryActivity(entry, entry.ownerEmail);

    return { status: "success", entry } satisfies LibraryActionResponse;
  } catch (error) {
    logger.error("Error al anadir un juego a la ludoteca", error);
    throw new HttpsError("internal", "No se pudo registrar el juego en la ludoteca.");
  }
});
