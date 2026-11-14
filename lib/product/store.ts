// Guest storage (M1): the profile, the payment log and the Pro flag in localStorage.
// This is the adapter to swap for server-side guest storage later, so its surface stays small.
// Reads are SSR-safe: on the server (and during hydration) the hooks return null / [] / false.
// If localStorage is unavailable (private mode, blocked storage) the data lives in memory for the tab.

import { useSyncExternalStore } from "react";
import type { LogEntry, NewLogEntry, Profile } from "./types";
import { entriesUsed, nextAdded } from "./freeLimit";
import { isLogEntry, isProfile } from "./validate";

export const STORAGE_KEYS = {
  profile: "pp.v1.profile",
  log: "pp.v1.log",
  pro: "pp.v1.pro",
  /** How many entries were ever added to the current log (deleting one doesn't lower it). */
  added: "pp.v1.added",
} as const;

type Key = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ---------------------------------------------------------------------------------------------------
// Raw storage with an in-memory fallback, and a change signal shared by all keys.

const memory = new Map<Key, string>();
/** Keys whose last write to localStorage failed: localStorage holds a stale value, memory holds the truth. */
const unsaved = new Set<Key>();
const listeners = new Set<() => void>();

function readRaw(key: Key): string | null {
  if (typeof window === "undefined") return null;
  if (unsaved.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: Key, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    unsaved.delete(key);
  } catch {
    // Storage blocked or full: reads of this key come from the in-memory copy above, so the tab keeps working.
    unsaved.add(key);
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || (Object.values(STORAGE_KEYS) as string[]).includes(e.key)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Parse once per distinct raw string so snapshots keep a stable identity (useSyncExternalStore needs it). */
function cachedReader<T>(key: Key, parse: (raw: string) => T, empty: T): () => T {
  let lastRaw: string | null = null;
  let lastValue: T = empty;
  return () => {
    const raw = readRaw(key);
    if (raw === null) return empty;
    if (raw !== lastRaw) {
      lastRaw = raw;
      try {
        lastValue = parse(raw);
      } catch {
        lastValue = empty;
      }
    }
    return lastValue;
  };
}

// ---------------------------------------------------------------------------------------------------
// Readers. What comes back from storage may be stale, edited or from another version (see ./validate).

const EMPTY_LOG: readonly LogEntry[] = Object.freeze([]);

const readProfile = cachedReader<Profile | null>(
  STORAGE_KEYS.profile,
  (raw) => {
    const v: unknown = JSON.parse(raw);
    return isProfile(v) ? v : null;
  },
  null,
);

const readLog = cachedReader<readonly LogEntry[]>(
  STORAGE_KEYS.log,
  (raw) => {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isLogEntry) : EMPTY_LOG;
  },
  EMPTY_LOG,
);

const readPro = cachedReader<boolean>(STORAGE_KEYS.pro, (raw) => raw === "1", false);

const readAddedRaw = cachedReader<number>(
  STORAGE_KEYS.added,
  (raw) => {
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  },
  0,
);

/** Entries counted against the free tier: never fewer than are in the log now. */
const readAdded = (): number => entriesUsed(readAddedRaw(), readLog().length);

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toEntry(entry: NewLogEntry, createdAt: string): LogEntry {
  return { ...entry, id: newId(), createdAt };
}

// ---------------------------------------------------------------------------------------------------
// Public API

/** The saved profile, or null if there is none (or on the server). */
export function getProfile(): Profile | null {
  return readProfile();
}

/**
 * Save the profile. Pass `options.log` to replace the payment log in the same step (`[]` clears it);
 * without it the log is kept.
 */
export function setProfile(profile: Profile, options?: { log?: readonly NewLogEntry[] }): void {
  writeRaw(STORAGE_KEYS.profile, JSON.stringify(profile));
  if (options?.log) {
    const now = new Date().toISOString();
    writeRaw(STORAGE_KEYS.log, JSON.stringify(options.log.map((e) => toEntry(e, now))));
    // A new log starts a new count (the entries it starts with count once they are there).
    writeRaw(STORAGE_KEYS.added, null);
  }
  emit();
}

/** Logged entries in the order they were added (oldest first). */
export function getLog(): readonly LogEntry[] {
  return readLog();
}

/** Append an entry; the store assigns `id` and `createdAt`. Returns the saved entry. */
export function addLogEntry(entry: NewLogEntry): LogEntry {
  const saved = toEntry(entry, new Date().toISOString());
  const log = readLog();
  writeRaw(STORAGE_KEYS.added, String(nextAdded(readAddedRaw(), log.length)));
  writeRaw(STORAGE_KEYS.log, JSON.stringify([...log, saved]));
  emit();
  return saved;
}

/**
 * How many entries were added to this log, counting deleted ones (at least the current log length).
 * The free tier counts this, so deleting an entry doesn't free a slot.
 */
export function getAddedCount(): number {
  return readAdded();
}

/** Everything the server copy holds (see ./planData): profile, log and the added count. */
export function getPlanSnapshot(): { profile: Profile | null; log: readonly LogEntry[]; added: number } {
  return { profile: readProfile(), log: readLog(), added: readAdded() };
}

/** Put a server copy back into this browser (profile, log and added count; the Pro flag is not touched). */
export function restorePlan(data: { profile: Profile; log: readonly LogEntry[]; added: number }): void {
  writeRaw(STORAGE_KEYS.profile, JSON.stringify(data.profile));
  writeRaw(STORAGE_KEYS.log, JSON.stringify(data.log));
  writeRaw(STORAGE_KEYS.added, String(data.added));
  emit();
}

/** Run `listener` after any change to the stored data. Returns the unsubscribe function. */
export function onStoreChange(listener: () => void): () => void {
  return subscribe(listener);
}

/** Remove an entry by id (no-op if it isn't there). The added count stays. */
export function removeLogEntry(id: string): void {
  writeRaw(STORAGE_KEYS.log, JSON.stringify(readLog().filter((e) => e.id !== id)));
  emit();
}

export function isPro(): boolean {
  return readPro();
}

export function setPro(pro: boolean): void {
  writeRaw(STORAGE_KEYS.pro, pro ? "1" : null);
  emit();
}

/** Forget everything: profile, log and Pro flag. */
export function resetAll(): void {
  writeRaw(STORAGE_KEYS.profile, null);
  writeRaw(STORAGE_KEYS.log, null);
  writeRaw(STORAGE_KEYS.pro, null);
  writeRaw(STORAGE_KEYS.added, null);
  emit();
}

// ---------------------------------------------------------------------------------------------------
// React hooks

/** The saved profile; null on the server, during hydration, and when there is none. */
export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, readProfile, () => null);
}

/** The payment log (oldest first); empty on the server and during hydration. */
export function useLog(): readonly LogEntry[] {
  return useSyncExternalStore(subscribe, readLog, () => EMPTY_LOG);
}

/** See `getAddedCount`; 0 on the server and during hydration. */
export function useAddedCount(): number {
  return useSyncExternalStore(subscribe, readAdded, () => 0);
}

export function usePro(): boolean {
  return useSyncExternalStore(subscribe, readPro, () => false);
}

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true once the client has the stored data. Use it to tell
 * "no profile yet" apart from "not loaded yet" (e.g. before redirecting away from a page).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
