// Guest storage (M1): the profile, the payment log and the Pro flag in localStorage.
// This is the adapter to swap for server-side guest storage later, so its surface stays small.
// Reads are SSR-safe: on the server (and during hydration) the hooks return null / [] / false.
// If localStorage is unavailable (private mode, blocked storage) the data lives in memory for the tab.

import { useSyncExternalStore } from "react";
import type { LogEntry, NewLogEntry, Profile } from "./types";

export const STORAGE_KEYS = {
  profile: "pp.v1.profile",
  log: "pp.v1.log",
  pro: "pp.v1.pro",
} as const;

type Key = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ---------------------------------------------------------------------------------------------------
// Raw storage with an in-memory fallback, and a change signal shared by all keys.

const memory = new Map<Key, string>();
const listeners = new Set<() => void>();

function readRaw(key: Key): string | null {
  if (typeof window === "undefined") return null;
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
  } catch {
    // Storage blocked or full: the in-memory copy above keeps the tab working.
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
// Validation of what comes back from storage (it may be stale, edited or from another version).

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function isProfile(v: unknown): v is Profile {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isStr(p.filingStatus) && isStr(p.state) && isNum(p.ytdIncome) && isNum(p.expectedIncome) &&
    isNum(p.w2Wages) && isNum(p.w2Withholding) && isNumOrNull(p.priorYearTax) && isNumOrNull(p.priorYearAgi) &&
    isNum(p.estimatedPaid) && isStr(p.createdAt) && typeof p.isExample === "boolean"
  );
}

function isLogEntry(v: unknown): v is LogEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    isStr(e.id) && (e.kind === "income" || e.kind === "irs") && isNum(e.amount) && isStr(e.payer) &&
    isStr(e.date) && isNum(e.setAside) && isStr(e.createdAt)
  );
}

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
  writeRaw(STORAGE_KEYS.log, JSON.stringify([...readLog(), saved]));
  emit();
  return saved;
}

/** Remove an entry by id (no-op if it isn't there). */
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
