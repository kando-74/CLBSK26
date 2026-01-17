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
  yearPublished: number | null;
  durationMinutes: number | null;
  weightValue: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  status: 'available' | 'borrowed';
  borrowedBy: {
    uid: string;
    alias: string;
  } | null;
  borrowedAt: number | null;
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
  yearPublished?: number | null;
  durationMinutes?: number | null;
  weightValue?: number | null;
  status?: 'available' | 'borrowed';
  borrowedBy?: {
    uid: string;
    alias: string;
  } | null;
  borrowedAt?: number | null;
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
  yearPublished?: number | null;
  durationMinutes?: number | null;
  weightValue?: number | null;
  createdAt?: { toDate?: () => Date } | number | null;
  updatedAt?: { toDate?: () => Date } | number | null;
  status?: 'available' | 'borrowed';
  borrowedBy?: {
    uid: string;
    alias: string;
  } | null;
  borrowedAt?: { toDate?: () => Date } | number | null;
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
    mechanics: ["Economa", "Redes", "Construccin"],
    coverUrl:
      "https://cf.geekdo-images.com/tnRbuD2sIh_2kcCF3cNq0g__original/img/jqfbtJwsV7cqV9rON32T6N4XK6g=/0x0/filters:format(png)/pic3490053.png",
    manual: false,
    bggId: 224517,
    eventId: "main-event",
    yearPublished: 2018,
    durationMinutes: 120,
    weightValue: 3.9,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12,
    status: 'available',
    borrowedBy: null,
    borrowedAt: null,
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
    yearPublished: 2022,
    durationMinutes: 60,
    weightValue: 2.9,
    createdAt: Date.now() - 1000 * 60 * 80,
    updatedAt: Date.now() - 1000 * 60 * 40,
    status: 'available',
    borrowedBy: null,
    borrowedAt: null,
  },
  {
    id: "seed-cascadia",
    title: "Cascadia",
    owner: "Organizacin",
    ownerId: null,
    ownerEmail: null,
    players: "1-4",
    duration: "30-45 min",
    weight: "1.9",
    language: "ES",
    mechanics: ["Draft", "Colocacin de losetas"],
    coverUrl:
      "https://cf.geekdo-images.com/5n03as0sVX07J1i8LojRXQ__original/img/zqht-UTn6QQGfS0vzVJpUl_ERc4=/0x0/filters:format(png)/pic6306303.png",
    manual: true,
    bggId: 295947,
    eventId: "main-event",
    yearPublished: 2021,
    durationMinutes: 45,
    weightValue: 1.9,
    createdAt: Date.now() - 1000 * 60 * 20,
    updatedAt: Date.now() - 1000 * 60 * 10,
    status: 'available',
    borrowedBy: null,
    borrowedAt: null,
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

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractNumbers(label: string): number[] {
  return (label.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((token) => Number(token.replace(',', '.')))
    .filter((token) => Number.isFinite(token));
}

function deriveDurationMinutes(record: { durationMinutes?: number | null; duration?: string }): number | null {
  if (typeof record.durationMinutes === 'number' && Number.isFinite(record.durationMinutes)) {
    return record.durationMinutes;
  }

  if (!record.duration) {
    return null;
  }

  const numericValues = extractNumbers(record.duration);
  if (numericValues.length === 0) {
    return null;
  }

  return Math.max(...numericValues);
}

function deriveWeightValue(record: { weightValue?: number | null; weight?: string }): number | null {
  if (typeof record.weightValue === 'number' && Number.isFinite(record.weightValue)) {
    return record.weightValue;
  }

  if (!record.weight) {
    return null;
  }

  const numericValues = extractNumbers(record.weight);
  if (numericValues.length === 0) {
    return null;
  }

  return numericValues[0];
}

function withComputedMetrics(game: LibraryGameRecord): LibraryGameRecord {
  return {
    ...game,
    durationMinutes: deriveDurationMinutes(game),
    weightValue: deriveWeightValue(game),
  };
}

function normalizeGameInput(input: LibraryGameInput): Required<LibraryGameInput> {
  const id = coerceString(
    input.id ?? (input.bggId ? `bgg-${input.bggId}` : `manual-${Date.now()}`),
    `manual-${Date.now()}`,
  );

  return {
    id,
    title: coerceString(input.title, "Juego sin ttulo"),
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
    yearPublished:
      typeof input.yearPublished === "number" && Number.isFinite(input.yearPublished)
        ? Math.trunc(input.yearPublished)
        : null,
    durationMinutes: coerceNumber(input.durationMinutes ?? null),
    weightValue: coerceNumber(input.weightValue ?? null),
    status: input.status ?? 'available',
    borrowedBy: input.borrowedBy ?? null,
    borrowedAt: input.borrowedAt ?? null,
  };
}

function mapFirestoreGame(id: string, data: FirestoreGame): LibraryGameRecord {
  try {
    const createdAt = data.createdAt;
    const updatedAt = data.updatedAt;
    const borrowedAt = data.borrowedAt;

    return withComputedMetrics({
      id,
      title: coerceString(data.title, "Juego sin ttulo"),
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
      yearPublished: data.yearPublished ?? null,
      durationMinutes: data.durationMinutes ?? null,
      weightValue: data.weightValue ?? null,
      createdAt:
        typeof createdAt === 'object' && createdAt && 'toDate' in createdAt && typeof (createdAt as any).toDate === 'function'
          ? (createdAt as any).toDate().getTime()
          : typeof createdAt === 'number'
            ? createdAt
            : null,
      updatedAt:
        typeof updatedAt === 'object' && updatedAt && 'toDate' in updatedAt && typeof (updatedAt as any).toDate === 'function'
          ? (updatedAt as any).toDate().getTime()
          : typeof updatedAt === 'number'
            ? updatedAt
            : null,
      status: data.status === 'borrowed' ? 'borrowed' : 'available',
      borrowedBy: data.borrowedBy ? { uid: data.borrowedBy.uid, alias: data.borrowedBy.alias } : null,
      borrowedAt:
        typeof borrowedAt === 'object' && borrowedAt && 'toDate' in borrowedAt && typeof (borrowedAt as any).toDate === 'function'
          ? (borrowedAt as any).toDate().getTime()
          : typeof borrowedAt === 'number'
            ? borrowedAt
            : null,
    });
  } catch (error) {
    console.error(`Error mapping Firestore game with ID ${id}:`, error);
    // Fallback to a default or partially mapped record if an error occurs
    return withComputedMetrics({
      id,
      title: coerceString(data.title, "Juego sin ttulo"),
      owner: coerceString(data.owner, "Participante"),
      ownerId: null,
      ownerEmail: null,
      players: "N/D",
      duration: "N/D",
      weight: "N/D",
      language: "N/D",
      mechanics: [],
      coverUrl: null,
      manual: false,
      bggId: null,
      eventId: null,
      yearPublished: null,
      durationMinutes: null,
      weightValue: null,
      createdAt: null,
      updatedAt: null,
      status: 'available',
      borrowedBy: null,
      borrowedAt: null,
    });
  }
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

    return (parsed
      .map((item) => (typeof item === 'object' && item ? (item as LibraryGameRecord) : null))
      .filter(Boolean) as LibraryGameRecord[]).map(withComputedMetrics);
  } catch (error) {
    console.warn('No se pudieron leer los juegos locales', error);
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
    yearPublished: game.yearPublished ?? null,
    durationMinutes: game.durationMinutes ?? null,
    weightValue: game.weightValue ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: game.status,
    borrowedBy: game.borrowedBy,
    borrowedAt: game.borrowedAt ? serverTimestamp() : null,
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
        yearPublished: game.yearPublished,
        durationMinutes: game.durationMinutes,
        weightValue: game.weightValue,
        status: game.status,
        borrowedBy: game.borrowedBy,
        borrowedAt: game.borrowedAt,
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
      return { status: "error", message: payload.message ?? "No se pudo aadir el juego." };
    }

    // Si no recibimos datos utilizables, hacemos una consulta manual
    const createdGame = await getDoc(doc(db, COLLECTION_NAME, game.id));
    if (createdGame.exists()) {
      return { status: "success", game: mapFirestoreGame(createdGame.id, createdGame.data() as FirestoreGame) };
    }

    return { status: "success", game: normalizeToRecord(game) };
  } catch (error) {
    console.warn("Fallo al usar la funcin addLibraryEntry", error);
    return { status: "error", message: "No se pudo registrar el juego en la ludoteca." };
  }
}

function normalizeToRecord(game: Required<LibraryGameInput>): LibraryGameRecord {
  const now = Date.now();
  return withComputedMetrics({
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
    yearPublished: game.yearPublished ?? null,
    durationMinutes: game.durationMinutes ?? null,
    weightValue: game.weightValue ?? null,
    createdAt: now,
    updatedAt: now,
    status: game.status,
    borrowedBy: game.borrowedBy,
    borrowedAt: game.borrowedAt ?? null,
  });
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
            console.error("Error en la suscripcin de la ludoteca", error);
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
        console.error("No se pudo aadir el juego a la ludoteca", error);
        return { status: "error", message: "No se pudo aadir el juego a la ludoteca." };
      }
    },
    [state.games],
  );

  const borrowGame = useCallback(
    async (gameId: string, user: { uid: string; alias: string }): Promise<LibraryActionResult> => {
      if (useFirestore) {
        try {
          const docRef = doc(db, COLLECTION_NAME, gameId)
          await setDoc(
            docRef,
            {
              status: 'borrowed',
              borrowedBy: {
                uid: user.uid,
                alias: user.alias,
              },
              borrowedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )

          const existingGame = state.games.find(g => g.id === gameId)
          if (!existingGame) {
            // Should not happen if subscribed, but purely for type safety:
            return { status: 'success', game: {} as LibraryGameRecord }
          }

          return { status: 'success', game: { ...existingGame, status: 'borrowed', borrowedBy: user, borrowedAt: Date.now() } }
        } catch (error) {
          console.error('Error borrowing game:', error)
          return { status: 'error', message: 'No se pudo registrar el préstamo.' }
        }
      }

      // Local
      const stored = readStoredGames()
      const index = stored.findIndex((g) => g.id === gameId)
      if (index === -1) {
        return { status: 'error', message: 'Juego no encontrado.' }
      }

      const game = stored[index]
      if (game.status === 'borrowed') {
        return { status: 'error', message: 'El juego ya está prestado.' }
      }

      const updated: LibraryGameRecord = {
        ...game,
        status: 'borrowed',
        borrowedBy: user,
        borrowedAt: Date.now(),
        updatedAt: Date.now(),
      }

      stored[index] = updated
      writeStoredGames(stored)
      setState((current) => ({
        ...current,
        games: current.games.map((g) => (g.id === gameId ? updated : g)),
      }))
      return { status: 'success', game: updated }
    },
    [state.games],
  )

  const returnGame = useCallback(
    async (gameId: string): Promise<LibraryActionResult> => {
      if (useFirestore) {
        try {
          const docRef = doc(db, COLLECTION_NAME, gameId)
          await setDoc(
            docRef,
            {
              status: 'available',
              borrowedBy: null,
              borrowedAt: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )

          const existingGame = state.games.find(g => g.id === gameId)
          if (!existingGame) {
            return { status: 'success', game: {} as LibraryGameRecord }
          }

          return { status: 'success', game: { ...existingGame, status: 'available', borrowedBy: null, borrowedAt: null } }
        } catch (error) {
          console.error('Error returning game:', error)
          return { status: 'error', message: 'No se pudo registrar la devolución.' }
        }
      }

      // Local
      const stored = readStoredGames()
      const index = stored.findIndex((g) => g.id === gameId)
      if (index === -1) {
        return { status: 'error', message: 'Juego no encontrado.' }
      }

      const updated: LibraryGameRecord = {
        ...stored[index],
        status: 'available',
        borrowedBy: null,
        borrowedAt: null,
        updatedAt: Date.now(),
      }

      stored[index] = updated
      writeStoredGames(stored)
      setState((current) => ({
        ...current,
        games: current.games.map((g) => (g.id === gameId ? updated : g)),
      }))
      return { status: 'success', game: updated }
    },
    [state.games],
  )

  return useMemo(
    () => ({
      ...state,
      games: normalizedGames,
      addGame,
      borrowGame,
      returnGame,
    }),
    [normalizedGames, state.loading, state.error, addGame, borrowGame, returnGame],
  );
}

export async function fetchLibraryGames(): Promise<LibraryGameRecord[]> {
  if (!useFirestore) {
    return readStoredGames();
  }

  return fetchRemoteGames();
}

export type LibraryFilter = {
  ownerIds?: string[];
  ownerNames?: string[];
  durationMin?: number | null;
  durationMax?: number | null;
  weightMin?: number | null;
  weightMax?: number | null;
  searchTerm?: string;
};

export type LibraryOwnerOption = {
  value: string;
  label: string;
  ownerId: string | null;
  count: number;
};

export function getLibraryOwnerOptions(games: LibraryGameRecord[]): LibraryOwnerOption[] {
  const map = new Map<string, LibraryOwnerOption>();

  games.forEach((game) => {
    const label = game.owner || 'Sin propietario';
    const key = game.ownerId ? `owner:${game.ownerId}` : `name:${label.toLowerCase()}`;
    const current = map.get(key);

    if (current) {
      current.count += 1;
    } else {
      map.set(key, { value: key, label, ownerId: game.ownerId, count: 1 });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
}

export function applyLibraryFilters(games: LibraryGameRecord[], filter: LibraryFilter): LibraryGameRecord[] {
  const ownersLower = (filter.ownerNames ?? []).map((name) => name.toLowerCase());
  const searchTerm = filter.searchTerm?.trim().toLowerCase() ?? '';

  return games.filter((game) => {
    if (filter.ownerIds && filter.ownerIds.length > 0) {
      if (!game.ownerId || !filter.ownerIds.includes(game.ownerId)) {
        return false;
      }
    }

    if (ownersLower.length > 0) {
      if (!ownersLower.includes(game.owner.toLowerCase())) {
        return false;
      }
    }

    if (typeof filter.durationMin === 'number') {
      if (game.durationMinutes === null || game.durationMinutes < filter.durationMin) {
        return false;
      }
    }

    if (typeof filter.durationMax === 'number') {
      if (game.durationMinutes === null || game.durationMinutes > filter.durationMax) {
        return false;
      }
    }

    if (typeof filter.weightMin === 'number') {
      if (game.weightValue === null || game.weightValue < filter.weightMin) {
        return false;
      }
    }

    if (typeof filter.weightMax === 'number') {
      if (game.weightValue === null || game.weightValue > filter.weightMax) {
        return false;
      }
    }

    if (searchTerm) {
      const haystack = `${game.title} ${game.owner} ${game.mechanics.join(' ')} ${game.language}`.toLowerCase();
      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
}
