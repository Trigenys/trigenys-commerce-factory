import { useRef } from "react";
import { landingCopy, showcaseConcepts, type LandingLanguage } from "./content";
import { useCarousel } from "./useCarousel";
import CarouselControls from "./CarouselControls";

const themeLinks: Record<string, string> = { fashion: "/themes/fashion-editorial", tech: "/themes/tech-precision", beauty: "/themes/beauty-ecrin" };

export default function ShowcaseCarousel({ language }: { language: LandingLanguage }) {
  const root = useRef<HTMLDivElement>(null);
  const carousel = useCarousel(root, showcaseConcepts.length);
  const t = landingCopy[language];
  return <div ref={root} className="showcase-carousel" role="group" aria-roledescription="carousel"
    aria-label={language === "fr" ? "Les univers de boutique" : "Storefront styles"}
    data-playing={carousel.playing} data-running={carousel.running}
    onMouseEnter={carousel.enter} onMouseLeave={carousel.leave} onFocusCapture={carousel.focus} data-reveal>
    <CarouselControls carousel={carousel} language={language} className="showcase-carousel-controls" />
    <div className="landing-concepts" aria-live={carousel.playing ? "off" : "polite"} aria-atomic={false}>
      {showcaseConcepts.map((item, index) => <article className={"landing-concept landing-concept--" + item.id}
        key={item.id} hidden={index !== carousel.index} role="group" aria-roledescription="slide" aria-label={item.brand + " — " + (index + 1) + " / 3"}>
        <div className="landing-concept-label"><span>{t.demo}</span><span aria-hidden="true">0{index + 1} / 03</span></div>
        <div className="landing-concept-preview">
          <div className="landing-concept-brand"><span aria-hidden="true">{item.initial}</span><strong>{item.brand}</strong><small>{t.preview}</small></div>
          <picture>
            <source type="image/avif" srcSet={"/landing/" + item.image + "-480.avif 480w, /landing/" + item.image + "-960.avif 512w"} sizes="(max-width: 700px) 90vw, 48vw" />
            <img src={"/landing/" + item.image + "-960.webp"} srcSet={"/landing/" + item.image + "-480.webp 480w, /landing/" + item.image + "-960.webp 512w"}
              sizes="(max-width: 700px) 90vw, 48vw" alt="" width={item.width} height={item.height} loading="lazy" decoding="async" />
          </picture>
          <div className="landing-concept-product"><strong>{item.name[language]}</strong><span>{item.price[language]}</span></div>
        </div>
        <div className="landing-concept-copy"><span className="overline">{item.category[language]}</span><h3>{item.brand}</h3><p>{item.body[language]}</p>
          <a className="landing-text-link" href={themeLinks[item.id] ?? "/themes"}>{language === "fr" ? "Explorer cet univers" : "Explore this style"}<span aria-hidden="true">↗</span></a>
        </div>
      </article>)}
    </div>
    <div className="showcase-carousel-picker" role="group" aria-label={language === "fr" ? "Choisir un univers" : "Choose a style"}>
      {showcaseConcepts.map((item, index) => <button type="button" key={item.id} aria-pressed={carousel.index === index} onClick={() => carousel.select(index)}><span aria-hidden="true">0{index + 1}</span>{item.category[language]}</button>)}
    </div>
  </div>;
}
