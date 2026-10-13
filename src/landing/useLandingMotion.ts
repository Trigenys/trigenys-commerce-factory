import { useEffect, type RefObject } from "react";
import { useReducedMotion } from "./useReducedMotion";

export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const shell = root.current;
    if (!shell || reduced) return;
    const revealNodes = [...shell.querySelectorAll<HTMLElement>("[data-reveal]")];
    // Read all positions together; interleaving each read with a class change
    // forced repeated whole-page layouts before the first mobile paint.
    const initiallyVisible = revealNodes.map(node => node.getBoundingClientRect().top < innerHeight * .94);
    shell.classList.add("motion-enabled");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed"); observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -5% 0px", threshold: .08 });
    for (const [index, node] of revealNodes.entries()) {
      // First-screen content remains painted immediately, including the hero.
      if (initiallyVisible[index]) node.classList.add("is-revealed");
      else { node.classList.add("reveal-ready"); observer.observe(node); }
    }
    const layers = [...shell.querySelectorAll<HTMLElement>("[data-parallax]")].map(node => ({
      node, anchor: node.closest<HTMLElement>("[data-parallax-anchor]") ?? node,
      strength: Number(node.dataset.parallax) || 16, current: 0
    }));
    let frame = 0;
    const tick = () => {
      frame = 0;
      const height = innerHeight;
      const positions = layers.map(layer => {
        const rect = layer.anchor.getBoundingClientRect();
        const inView = rect.bottom > -100 && rect.top < height + 100;
        const progress = Math.max(-1, Math.min(1, (height / 2 - rect.top - rect.height / 2) / (height / 2 + rect.height / 2)));
        return { layer, inView, target: inView ? progress * layer.strength : 0 };
      });
      let settling = false;
      for (const { layer, inView, target } of positions) {
        layer.current += (target - layer.current) * .16;
        if (Math.abs(target - layer.current) < .08) layer.current = target;
        else if (inView) settling = true;
        layer.node.style.setProperty("--parallax-y", layer.current.toFixed(2) + "px");
        layer.node.classList.toggle("is-parallax-visible", inView);
      }
      if (settling) frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Start the parallax on native scrolling, keeping the first image paint stable.
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
      shell.classList.remove("motion-enabled");
      for (const node of revealNodes) node.classList.remove("reveal-ready", "is-revealed");
      for (const layer of layers) { layer.node.style.removeProperty("--parallax-y"); layer.node.classList.remove("is-parallax-visible"); }
    };
  }, [root, reduced]);
}
