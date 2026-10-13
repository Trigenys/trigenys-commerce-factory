import { useEffect, useRef, useState, type FocusEvent, type RefObject } from "react";
import { useReducedMotion } from "./useReducedMotion";

// Rotation follows the WAI carousel pattern: focus stops it until an explicit
// restart; hover, a hidden tab and an off-screen scene suspend the timer.
export function useCarousel(root: RefObject<HTMLElement | null>, count: number, interval = 8000) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [requested, setRequested] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [hasChanged, setHasChanged] = useState(false);
  const pointerAction = useRef<boolean | null>(null);
  const playing = requested && !reduced;
  const running = playing && !hovered && inView && visible;

  useEffect(() => { if (reduced) setRequested(false); }, [reduced]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= .2), { threshold: [0, .2] });
    observer.observe(node);
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, [root]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => { setIndex(current => (current + 1) % count); setHasChanged(true); }, interval);
    return () => window.clearTimeout(timer);
  }, [running, index, count, interval]);

  function select(next: number) {
    setRequested(false); setHasChanged(true); setIndex((next + count) % count);
  }
  function focus(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRequested(false);
  }
  function toggle() {
    const start = pointerAction.current ?? !playing;
    pointerAction.current = null;
    if (!reduced) setRequested(start);
  }
  return {
    index, playing, running, reduced, hasChanged, select, toggle,
    previous: () => select(index - 1), next: () => select(index + 1),
    rememberPointerAction: () => { pointerAction.current = !playing; },
    focus, enter: () => setHovered(true), leave: () => setHovered(false)
  };
}
