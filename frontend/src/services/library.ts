import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db } from "../utils/firebase";

export type LibraryGameRecord = {
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
  createdAt: number | null;
  updatedAt: number | null;
};

export type LibraryGameInput = {
  id?: string;
  title: string;
  owner: string;
  ownerId?: string | null;
  ownerEmail?: string | null;
  players: string;
  duration: string;
  weight: string;
  language: string;
  mechanics: string[];
  coverUrl?: string | null;
  manual?: boolean;
  bggId?: number | null;
  eventId?: string | null;
};

export type LibraryActionStatus = "success" | "already-exists" | "error";

export type LibraryActionResult =
  | { status: "success"; game: LibraryGameRecord }
  | { status: "already-exists"; game: LibraryGameRecord }
  | { status: "error"; message: string };

type FirestoreGame = {
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
  manual?: boolean;
  bggId?: number | null;
  eventId?: string | null;
  createdAt?: { toDate?: () => Date } | number | null;
  updatedAt?: { toDate?: () => Date } | number | null;
};

const STORAGE_KEY = "clbsk_event_library_v1";
const COLLECTION_NAME = "libraryEntries";
const functions = getFunctions();
const addLibraryEntryCallable = httpsCallable(functions, "addLibraryEntry");

const seedGames: LibraryGameRecord[] = [
  {
    id: "seed-brass-birmingham",
    title: "Brass: Birmingham",
    owner: "Marina",
    ownerId: null,
    ownerEmail: null,
    players: "2-4",
    duration: "90-120 min",
    weight: "3.9",
    language: "ES",
    mechanics: ["Econom�a", "Redes", "Construcci�n"],
    coverUrl:
      "https://cf.geekdo-images.com/tnRbuD2sIh_2kcCF3cNq0g__original/img/jqfbtJwsV7cqV9rON32T6N4XK6g=/0x0/filters:format(png)/pic3490053.png",
    manual: false,
    bggId: 224517,
    eventId: "main-event",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    id: "seed-heat",
    title: "Heat: Pedal to the Metal",
    owner: "Ana",
    ownerId: null,
    ownerEmail: null,
    players: "2-6",
    duration: "45-60 min",
    weight: "2.9",
    language: "ES",
    mechanics: ["Carreras", "Mazo", "Hand management"],
    coverUrl:
      "https://cf.geekdo-images.com/Be0WLPNJGThMtwHyQ4p4lw__original/img/oVfblVOz4nFQ8kTq-OabpCEwKn0=/0x0/filters:format(png)/pic7101969.png",
    manual: false,
    bggId: 366013,
    eventId: "main-event",
    createdAt: Date.now() - 1000 * 60 * 80,
    updatedAt: Date.now() - 1000 * 60 * 40,
  },
  {
    id: "seed-cascadia",
    title: "Cascadia",
    owner: "Organizaci�n",
    ownerId: null,
    ownerEmail: null,
    players: "1-4",
    duration: "30-45 min",
    weight: "1.9",
    language: "ES",
    mechanics: ["Draft", "Colocaci�n de losetas"],
    coverUrl:
      "https://cf.geekdo-images.com/5n03as0sVX07J1i8LojRXQ__original/img/zqht-UTn6QQGfS0vzVJpUl_ERc4=/0x0/filters:format(png)/pic6306303.png",
    manual: true,
    bggId: 295947,
    eventId: "main-event",
    createdAt: Date.now() - 1000 * 60 * 20,
    updatedAt: Date.now() - 1000 * 60 * 10,
  },
];

const forceLocalLibrary = import.meta.env.VITE_FORCE_LOCAL_LIBRARY === "true";
const isTestEnvironment = import.meta.env.MODE === "test";
const useFirestore = !forceLocalLibrary && !isTestEnvironment;

function coerceString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 16);
}

function normalizeGameInput(input: LibraryGameInput): Required<LibraryGameInput> {
  const id = coerceString(
    input.id ?? (input.bggId ? `bgg-${input.bggId}` : `manual-${Date.now()}`),
    `manual-${Date.now()}`,
  );

  return {
    id,
    title: coerceString(input.title, "Juego sin t�tulo"),
    owner: coerceString(input.owner, "Participante"),
    ownerId: input.ownerId ?? null,
    ownerEmail: input.ownerEmail ?? null,
    players: coerceString(input.players, "N/D"),
    duration: coerceString(input.duration, "N/D"),
    weight: coerceString(input.weight, "N/D"),
    language: coerceString(input.language, "N/D"),
    mechanics: coerceStringArray(input.mechanics),
    coverUrl: input.coverUrl ?? null,
    manual: Boolean(input.manual ?? !input.bggId),
    bggId: input.bggId ?? null,
    eventId: input.eventId ?? "main-event",
  };
}

function mapFirestoreGame(id: string, data: FirestoreGame): LibraryGameRecord {
  const createdAt = data.createdAt;
  const updatedAt = data.updatedAt;

  return {
    id,
    title: coerceString(data.title, "Juego sin t�tulo"),
    owner: coerceString(data.owner, "Participante"),
    ownerId: coerceString(data.ownerId ?? null, "") || null,
    ownerEmail: coerceString(data.ownerEmail ?? null, "") || null,
    players: coerceString(data.players, "N/D"),
    duration: coerceString(data.duration, "N/D"),
    weight: coerceString(data.weight, "N/D"),
    language: coerceString(data.language, "N/D"),
    mechanics: coerceStringArray(data.mechanics),
    coverUrl: coerceString(data.coverUrl ?? null, "") || null,
    manual: Boolean(data.manual ?? !data.bggId),
    bggId: typeof data.bggId === "number" ? data.bggId : null,
    eventId: coerceString(data.eventId ?? null, "") || null,
    createdAt:
      typeof createdAt === "number"
        ? createdAt
        : typeof createdAt?.toDate === "function"
          ? createdAt.toDate().getTime()
          : null,
    updatedAt:
      typeof updatedAt === "number"
        ? updatedAt
        : typeof updatedAt?.toDate === "function"
          ? updatedAt.toDate().getTime()
          : null,
  };
}

function resolveStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.warn("No se pudo acceder a localStorage", error);
    return null;
  }
}

function readStoredGames(): LibraryGameRecord[] {
  const storage = resolveStorage();
  if (!storage) {
    return seedGames;
  }

  try {
    const value = storage.getItem(STORAGE_KEY);
    if (!value) {
      storage.setItem(STORAGE_KEY, JSON.stringify(seedGames));
      return seedGames;
    }

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return seedGames;
    }

    return parsed
      .map((item) => (typeof item === "object" && item ? (item as LibraryGameRecord) : null))
      .filter(Boolean) as LibraryGameRecord[];
  } catch (error) {
    console.warn("No se pudieron leer los juegos locales", error);
    return seedGames;
  }
}

function writeStoredGames(games: LibraryGameRecord[]) {
  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch (error) {
    console.warn("No se pudieron actualizar los juegos locales", error);
  }
}

async function fetchRemoteGames(): Promise<LibraryGameRecord[]> {
  try {
    const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), orderBy("titleLower")));
    return snapshot.docs.map((document) => mapFirestoreGame(document.id, document.data() as FirestoreGame));
  } catch (error) {
    console.error("No se pudieron recuperar los juegos de Firestore", error);
    throw error;
  }
}

async function createRemoteGame(game: Required<LibraryGameInput>): Promise<LibraryGameRecord> {
  const docRef = doc(db, COLLECTION_NAME, game.id);
  await setDoc(docRef, {
    title: game.title,
    titleLower: game.title.toLowerCase(),
    owner: game.owner,
    ownerId: game.ownerId,
    ownerEmail: game.ownerEmail ?? null,
    players: game.players,
    duration: game.duration,
    weight: game.weight,
    language: game.language,
    mechanics: game.mechanics,
    coverUrl: game.coverUrl ?? null,
    manual: game.manual,
    bggId: game.bggId ?? null,
    eventId: game.eventId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(docRef);
  return mapFirestoreGame(snapshot.id, (snapshot.data() ?? {}) as FirestoreGame);
}

async function createRemoteThroughFunction(game: Required<LibraryGameInput>): Promise<LibraryActionResult> {
  try {
    const response = await addLibraryEntryCallable({
      entry: {
        id: game.id,
        title: game.title,
        owner: game.owner,
        ownerId: game.ownerId,
        ownerEmail: game.ownerEmail,
        players: game.players,
        duration: game.duration,
        weight: game.weight,
        language: game.language,
        mechanics: game.mechanics,
        coverUrl: game.coverUrl,
        manual: game.manual,
        bggId: game.bggId,
        eventId: game.eventId,
      },
    });

    const payload = response.data as { status?: LibraryActionStatus; entry?: FirestoreGame & { id?: string }; message?: string };
    if (payload?.status === "already-exists" && payload.entry && payload.entry.id) {
      return { status: "already-exists", game: mapFirestoreGame(payload.entry.id, payload.entry) };
    }

    if (payload?.status === "success" && payload.entry && payload.entry.id) {
      return { status: "success", game: mapFirestoreGame(payload.entry.id, payload.entry) };
    }

    if (payload?.status === "error") {
      return { status: "error", message: payload.message ?? "No se pudo a�adir el juego." };
    }

    // Si no recibimos datos utilizables, hacemos una consulta manual
    const createdGame = await getDoc(doc(db, COLLECTION_NAME, game.id));
    if (createdGame.exists()) {
      return { status: "success", game: mapFirestoreGame(createdGame.id, createdGame.data() as FirestoreGame) };
    }

    return { status: "success", game: normalizeToRecord(game) };
  } catch (error) {
    console.warn("Fallo al usar la funci�n addLibraryEntry", error);
    return { status: "error", message: "No se pudo registrar el juego en la ludoteca." };
  }
}

function normalizeToRecord(game: Required<LibraryGameInput>): LibraryGameRecord {
  const now = Date.now();
  return {
    id: game.id,
    title: game.title,
    owner: game.owner,
    ownerId: game.ownerId ?? null,
    ownerEmail: game.ownerEmail ?? null,
    players: game.players,
    duration: game.duration,
    weight: game.weight,
    language: game.language,
    mechanics: game.mechanics,
    coverUrl: game.coverUrl ?? null,
    manual: game.manual,
    bggId: game.bggId ?? null,
    eventId: game.eventId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

async function createLocalGame(game: Required<LibraryGameInput>): Promise<LibraryGameRecord> {
  const existing = readStoredGames();
  const record = normalizeToRecord(game);
  writeStoredGames([record, ...existing.filter((item) => item.id !== record.id)]);
  return record;
}

async function findRemoteDuplicate(game: Required<LibraryGameInput>): Promise<LibraryGameRecord | null> {
  if (!game.bggId) {
    return null;
  }

  const duplicateSnapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), where("bggId", "==", game.bggId), orderBy("titleLower"), orderBy("createdAt", "desc")),
  );

  if (duplicateSnapshot.empty) {
    return null;
  }

  const document = duplicateSnapshot.docs[0];
  return mapFirestoreGame(document.id, document.data() as FirestoreGame);
}

export type LibraryServiceState = {
  loading: boolean;
  error: string | null;
  games: LibraryGameRecord[];
};

export function useLibraryService() {
  const [state, setState] = useState<LibraryServiceState>({ loading: true, error: null, games: [] });

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    async function initialize() {
      setState((current) => ({ ...current, loading: true, error: null }));

      if (!useFirestore) {
        const localGames = readStoredGames();
        if (!cancelled) {
          setState({ loading: false, error: null, games: localGames });
        }
        return;
      }

      try {
        const collectionRef = collection(db, COLLECTION_NAME);
        const libraryQuery = query(collectionRef, orderBy("titleLower"));

        unsubscribe = onSnapshot(
          libraryQuery,
          (snapshot) => {
            const games = snapshot.docs.map((document) =>
              mapFirestoreGame(document.id, document.data() as FirestoreGame),
            );
            setState({ loading: false, error: null, games });
          },
          (error) => {
            console.error("Error en la suscripci�n de la ludoteca", error);
            setState((current) => ({ ...current, loading: false, error: "No se pudo sincronizar la ludoteca." }));
          },
        );
      } catch (error) {
        console.error("No se pudo inicializar la ludoteca", error);
        setState((current) => ({ ...current, loading: false, error: "No se pudo cargar la ludoteca." }));
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const normalizedGames = useMemo(() => {
    if (state.games.length > 0) {
      return state.games;
    }
    return seedGames;
  }, [state.games]);

  const addGame = useCallback(
    async (input: LibraryGameInput): Promise<LibraryActionResult> => {
      const normalized = normalizeGameInput(input);

      const duplicateById = state.games.find((game) => game.id === normalized.id);
      if (duplicateById) {
        return { status: "already-exists", game: duplicateById };
      }

      const duplicateByBgg = normalized.bggId
        ? state.games.find((game) => game.bggId === normalized.bggId)
        : undefined;
      if (duplicateByBgg) {
        return { status: "already-exists", game: duplicateByBgg };
      }

      try {
        if (!useFirestore) {
          const game = await createLocalGame(normalized);
          setState((current) => ({
            loading: false,
            error: null,
            games: [game, ...current.games.filter((item) => item.id !== game.id)],
          }));
          return { status: "success", game };
        }

        const duplicateRemote = await findRemoteDuplicate(normalized);
        if (duplicateRemote) {
          return { status: "already-exists", game: duplicateRemote };
        }

        const createdViaFunction = await createRemoteThroughFunction(normalized);
        if (createdViaFunction.status !== "error") {
          return createdViaFunction;
        }

        const game = await createRemoteGame(normalized);
        return { status: "success", game };
      } catch (error) {
        console.error("No se pudo a�adir el juego a la ludoteca", error);
        return { status: "error", message: "No se pudo a�adir el juego a la ludoteca." };
      }
    },
    [state.games],
  );

  return { ...state, games: normalizedGames, addGame };
}

export async function fetchLibraryGames(): Promise<LibraryGameRecord[]> {
  if (!useFirestore) {
    return readStoredGames();
  }

  return fetchRemoteGames();
}
