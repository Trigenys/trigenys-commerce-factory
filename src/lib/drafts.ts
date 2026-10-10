import { useEffect, useState } from "react";

export function readDraft<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || "null");
    return stored && validate(stored) ? stored : fallback;
  } catch { return fallback; }
}

export function useDraft<T>(key: string, initial: T, validate: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => readDraft(key, initial, validate));
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); }
    catch { setAvailable(false); }
  }, [key, value]);
  function discard() { try { sessionStorage.removeItem(key); } catch { /* Optional browser storage. */ } }
  function persist(next:T) {try { sessionStorage.setItem(key,JSON.stringify(next)); }catch {setAvailable(false);}setValue(next);}
  return { value, setValue:persist, discard, available };
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
