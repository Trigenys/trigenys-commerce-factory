import { useLayoutEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "./useReducedMotion";

export function useScrollStory(track: RefObject<HTMLDivElement | null>, scene: RefObject<HTMLDivElement | null>, onStage: (stage: 0 | 1 | 2 | 3) => void) {
  const reduced = useReducedMotion();
  const geometry = useRef({ enabled: false, offset: 90, span: 0 });
  useLayoutEffect(() => {
    const rail = track.current, panel = scene.current;
    if (!rail || !panel) return;
    let frame = 0, lastStage = -1, inView = false;
    function update() {
      frame = 0;
      if (!geometry.current.enabled || !inView || !rail) return;
      const progress = Math.max(0, Math.min(1, (geometry.current.offset - rail.getBoundingClientRect().top) / geometry.current.span));
      const phase = Math.round(progress * 3) as 0 | 1 | 2 | 3;
      rail.style.setProperty("--story-progress", String(progress));
      if (phase !== lastStage) { lastStage = phase; onStage(phase); }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    function configure() {
      if (!rail || !panel) return;
      const offset = (document.querySelector(".site-header")?.getBoundingClientRect().height ?? 78) + 12;
      rail.style.setProperty("--story-top", offset + "px");
      rail.classList.toggle("is-scroll-story", !reduced && innerHeight >= 700);
      const height = panel.getBoundingClientRect().height;
      const enabled = !reduced && innerHeight >= 700 && height + offset + 18 <= innerHeight;
      rail.classList.toggle("is-scroll-story", enabled);
      rail.dataset.scrollEnabled = String(enabled);
      const span = Math.max(900, innerHeight * 1.8);
      geometry.current = { enabled, offset, span };
      if (enabled) { rail.style.setProperty("--story-height", height + "px"); rail.style.setProperty("--story-span", span + "px"); }
      else { rail.style.removeProperty("--story-height"); rail.style.removeProperty("--story-span"); }
      schedule();
    }
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) schedule(); }, { rootMargin: "100px" });
    observer.observe(rail);
    const resize = new ResizeObserver(configure);
    resize.observe(panel);
    configure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", configure);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", configure);
      rail.classList.remove("is-scroll-story"); rail.dataset.scrollEnabled = "false";
      rail.style.removeProperty("--story-height"); rail.style.removeProperty("--story-span");
      geometry.current.enabled = false;
    };
  }, [track, scene, reduced, onStage]);

  return (stage: 0 | 1 | 2 | 3) => {
    const rail = track.current;
    onStage(stage);
    if (!rail || !geometry.current.enabled) return;
    const target = scrollY + rail.getBoundingClientRect().top - geometry.current.offset + geometry.current.span * stage / 3;
    // Explicit step controls select one scene, without flashing every intermediate scene.
    window.scrollTo({ top: target, behavior: "instant" });
  };
}
