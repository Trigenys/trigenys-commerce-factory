import { useRef } from "react";
import { useCarousel } from "../landing/useCarousel";
import "./auth-carousel.css";

// The French campaign copy is already part of each image. Keep the on-screen
// controls and screen-reader descriptions localized without duplicating text.
const englishSlides = [
  { title: "Your online store, made simple.", alt: "Entrepreneur managing her online boutique and incoming orders." },
  { title: "Your products deserve to be seen.", alt: "Merchant showcasing products with a digital storefront." },
  { title: "Sell anywhere, anytime.", alt: "Entrepreneur using a smartphone to handle sales." },
  { title: "Your orders, under control.", alt: "Merchant preparing an order in her shop." },
  { title: "A storefront that looks like you.", alt: "Entrepreneur managing her store's online identity." },
  { title: "Grow at your own pace.", alt: "Entrepreneur preparing a package for a customer." }
] as const;

const slides = [
  {
    "id": "slide-1",
    "src": "/login-carousel/01-boutique-en-ligne.webp",
    "title": "Votre boutique en ligne, simplement.",
    "alt": "Entrepreneure à son ordinateur, boutique et commandes.",
    "locale": "fr",
    "width": 1279,
    "height": 720
  },
  {
    "id": "slide-2",
    "src": "/login-carousel/02-visibilite-produits.webp",
    "title": "Vos produits méritent d’être vus.",
    "alt": "Commerçante présentant ses créations, vitrine numérique.",
    "locale": "fr",
    "width": 1279,
    "height": 720
  },
  {
    "id": "slide-3",
    "src": "/login-carousel/03-vente-mobile.webp",
    "title": "Vendez partout, à tout moment.",
    "alt": "Entrepreneure utilisant son smartphone pour vendre.",
    "locale": "fr",
    "width": 1279,
    "height": 720
  },
  {
    "id": "slide-4",
    "src": "/login-carousel/04-gestion-commandes.webp",
    "title": "Vos commandes, sous contrôle.",
    "alt": "Commerçante préparant un colis dans sa boutique.",
    "locale": "fr",
    "width": 1280,
    "height": 720
  },
  {
    "id": "slide-5",
    "src": "/login-carousel/05-boutique-a-votre-image.webp",
    "title": "Une boutique à votre image.",
    "alt": "Entrepreneure pilotant la présence numérique de sa boutique.",
    "locale": "fr",
    "width": 1279,
    "height": 720
  },
  {
    "id": "slide-6",
    "src": "/login-carousel/06-croissance.webp",
    "title": "Grandissez à votre rythme.",
    "alt": "Entrepreneure préparant une commande dans son atelier.",
    "locale": "fr",
    "width": 1279,
    "height": 720
  }
] as const;

export default function AuthCarousel({ language }: { language: "fr" | "en" }) {
  const root = useRef<HTMLElement>(null);
  const carousel = useCarousel(root, slides.length, 7000);
  const fr = language === "fr";
  const activeTitle = fr ? slides[carousel.index].title : englishSlides[carousel.index].title;
  const pauseLabel = fr ? "Suspendre le défilement" : "Pause slideshow";
  const playLabel = fr ? "Reprendre le défilement" : "Resume slideshow";

  return (
    <aside
      ref={root}
      className="auth-showcase"
      role="region"
      aria-roledescription="carousel"
      aria-label={fr ? "Découvrez Commerce Factory en six images" : "Discover Commerce Factory in six images"}
      onMouseEnter={carousel.enter}
      onMouseLeave={carousel.leave}
      onFocusCapture={carousel.focus}
    >
      <div className="auth-showcase-frame" aria-live={carousel.playing ? "off" : "polite"}>
        {slides.map((slide, index) => (
          <figure
            key={slide.id}
            className="auth-showcase-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={String(index + 1) + " / " + slides.length + " — " + (fr ? slide.title : englishSlides[index].title)}
            hidden={index !== carousel.index}
          >
            <img
              src={slide.src}
              alt={fr ? slide.alt : englishSlides[index].alt}
              width={slide.width}
              height={slide.height}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </figure>
        ))}
      </div>
      <div className="auth-showcase-toolbar">
        <div className="auth-showcase-current">
          <span className="auth-showcase-counter" aria-hidden="true">
            {String(carousel.index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <span className="auth-showcase-title">{activeTitle}</span>
        </div>
        <div className="auth-showcase-dots" role="group" aria-label={fr ? "Choisir une image" : "Choose a slide"}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={(fr ? "Afficher l’image " : "Show slide ") + (index + 1)}
              aria-pressed={carousel.index === index}
              title={fr ? slide.title : englishSlides[index].title}
              onClick={() => carousel.select(index)}
            />
          ))}
        </div>
        <div className="auth-showcase-actions">
          <button type="button" onClick={carousel.previous} aria-label={fr ? "Image précédente" : "Previous slide"}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" onClick={carousel.next} aria-label={fr ? "Image suivante" : "Next slide"}>
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            onPointerDown={carousel.rememberPointerAction}
            onClick={carousel.toggle}
            disabled={carousel.reduced}
            aria-label={carousel.reduced ? (fr ? "Défilement manuel (animations réduites)" : "Manual slideshow (reduced motion)") : carousel.playing ? pauseLabel : playLabel}
            title={carousel.playing ? pauseLabel : playLabel}
          >
            <span aria-hidden="true">{carousel.playing ? "Ⅱ" : "▶"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
