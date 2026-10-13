import { useLayoutEffect, type RefObject } from "react";

type ChromeProperty = "--merchant-header-height" | "--merchant-mobile-nav-height" | "--merchant-notice-height" | "--merchant-page-toolbar-height";

export function useChromeHeight(ref: RefObject<HTMLElement | null>, property: ChromeProperty, mobileOnly = false) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue(property);
    const media = window.matchMedia("(max-width: 850px)");
    const update = () => {
      const height = mobileOnly && !media.matches ? 0 : Math.ceil(element.getBoundingClientRect().height);
      const value = height + "px";
      if (root.style.getPropertyValue(property) !== value) root.style.setProperty(property, value);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    if (!observer) window.addEventListener("resize", update);
    if (mobileOnly) media.addEventListener("change", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      if (mobileOnly) media.removeEventListener("change", update);
      if (previous) root.style.setProperty(property, previous);
      else root.style.removeProperty(property);
    };
  }, [ref, property, mobileOnly]);
}
