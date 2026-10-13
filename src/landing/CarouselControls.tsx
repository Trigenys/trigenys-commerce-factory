import type { useCarousel } from "./useCarousel";

type Carousel = ReturnType<typeof useCarousel>;
export default function CarouselControls({ carousel, language, count = 3, className = "" }: {
  carousel: Carousel; language: "fr" | "en"; count?: number; className?: string;
}) {
  const fr = language === "fr";
  const action = carousel.reduced ? (fr ? "Lecture manuelle" : "Manual playback") : carousel.playing ? (fr ? "Pause" : "Pause") : (fr ? "Lecture auto" : "Auto play");
  return <div className={"carousel-controls " + className}>
    <button type="button" className="carousel-rotation" disabled={carousel.reduced}
      onPointerDown={carousel.rememberPointerAction} onClick={carousel.toggle}
      aria-label={carousel.reduced ? action : carousel.playing ? (fr ? "Pause du défilement automatique" : "Pause automatic rotation") : (fr ? "Lecture auto des boutiques" : "Auto play storefronts")}>
      <span aria-hidden="true">{carousel.playing ? "Ⅱ" : "▷"}</span><span>{action}</span>
    </button>
    <button type="button" className="carousel-previous" onClick={carousel.previous} aria-label={fr ? "Boutique précédente" : "Previous storefront"}>←</button>
    <span className="carousel-count" aria-hidden="true">0{carousel.index + 1}<i />0{count}</span>
    <button type="button" className="carousel-next" onClick={carousel.next} aria-label={fr ? "Boutique suivante" : "Next storefront"}>→</button>
  </div>;
}
