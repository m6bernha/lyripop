import { useEffect, useState } from "react";

/**
 * Persisted React state backed by `window.localStorage`. Values are
 * JSON-serialised so booleans, numbers, and small objects round-trip without
 * extra parsing at the call-site.
 *
 * - The initial state is computed lazily so localStorage is only read on
 *   first mount, not on every render.
 * - An optional `validate` predicate guards against drift when stored data
 *   shape changes between releases — invalid values silently fall back to
 *   `defaultValue`, matching how `App.tsx` already treats unknown view/mode
 *   strings.
 * - Writes are best-effort; localStorage failures (private mode quirks,
 *   quota exhaustion) are swallowed because no setting in this app is
 *   important enough to break the UI over.
 *
 * Not used for `view` / `mode` in `App.tsx`: those predate this hook and
 * use plain-string storage. New settings should prefer this hook.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  validate?: (raw: unknown) => raw is T
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed = JSON.parse(raw) as unknown;
      if (validate && !validate(parsed)) return defaultValue;
      return parsed as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
