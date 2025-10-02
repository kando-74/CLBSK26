import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const libraryCollection = db.collection("libraryEntries");
const activityCollection = db.collection("activityLogs");
const authorizedEmailsCollection = db.collection("authorizedEmails");

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





