import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChromeHeight } from "./merchant-chrome";
import "./merchant-notice.css";

type Notice = { id: number; kind: "success" | "error"; message: string };

export function useMerchantNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const sequence = useRef(0);
  const notify = useCallback((kind: Notice["kind"], message: string) => {
    setNotice({ id: ++sequence.current, kind, message });
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);
  return { notice, notify, dismiss };
}

export default function MerchantNotice({ notice, language, onDismiss }: {
  notice: Notice | null; language: "fr" | "en"; onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pausedId, setPausedId] = useState<number | null>(null);
  const paused = Boolean(notice && notice.id === pausedId);
  useChromeHeight(ref, "--merchant-notice-height");
  useEffect(() => {
    if (!notice || notice.kind !== "success" || paused) return;
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [notice, paused, onDismiss]);
  useEffect(() => {
    if (!notice) return;
    const keepFocusVisible = (event: FocusEvent) => {
      const target = event.target;
      const card = ref.current;
      if (!(target instanceof HTMLElement) || !card || card.contains(target)) return;
      const focused = target.getBoundingClientRect();
      const overlay = card.getBoundingClientRect();
      if (focused.bottom > overlay.top && focused.top < overlay.bottom && focused.right > overlay.left && focused.left < overlay.right) onDismiss();
    };
    document.addEventListener("focusin", keepFocusVisible);
    return () => document.removeEventListener("focusin", keepFocusVisible);
  }, [notice, onDismiss]);

  return createPortal(<div
    ref={ref}
    className={"merchant-notice " + (notice?.kind || "")}
    data-visible={Boolean(notice)}
    onPointerEnter={() => setPausedId(notice?.id ?? null)}
    onPointerLeave={() => setPausedId(null)}
    onFocusCapture={() => setPausedId(notice?.id ?? null)}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPausedId(null);
    }}
  >
    {notice ? <span className="merchant-notice-icon" aria-hidden="true">{notice.kind === "success" ? "✓" : "!"}</span> : null}
    <div className="merchant-notice-content">
      <div role="status" aria-live="polite" aria-atomic="true">{notice?.kind === "success" ? notice.message : ""}</div>
      <div role="alert" aria-atomic="true">{notice?.kind === "error" ? notice.message : ""}</div>
    </div>
    {notice ? <button type="button" onClick={onDismiss} aria-label={language === "fr" ? "Fermer la notification" : "Dismiss notification"}>×</button> : null}
  </div>, document.body);
}
