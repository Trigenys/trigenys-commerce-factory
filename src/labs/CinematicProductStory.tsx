import { useEffect, useRef, useState } from "react";
import "./cinematic-product-story.css";

type Language = "fr" | "en";
type Copy = { category: string; title: string; detail: string; chapter: string; note: string };
type Scene = {
  id: string;
  image: string;
  theme: string;
  link: string;
  number: string;
  fr: Copy;
  en: Copy;
};

const scenes: readonly Scene[] = [
  {
    id: "rituel", image: "/themes/beauty-v1-960.webp", theme: "amber", number: "01",
    link: "/themes/beauty-ecrin",
    fr: { category: "RITUELS / BEAUTÉ", title: "Le rituel devient matière.", detail: "Le moindre détail mérite sa propre lumière.", chapter: "La matière capte le regard", note: "Une direction sensorielle, sans détourner le visiteur du produit." },
    en: { category: "RITUALS / BEAUTY", title: "Make the ritual tangible.", detail: "Every detail deserves its own light.", chapter: "Material catches the eye", note: "A sensorial direction without distracting from the product." }
  },
  {
    id: "interieur", image: "/themes/home-v1-960.webp", theme: "sage", number: "02",
    link: "/themes/home-habitat",
    fr: { category: "ESPACES / MAISON", title: "L'espace a sa propre voix.", detail: "Une pièce, une texture, une histoire à habiter.", chapter: "L'espace raconte", note: "Le récit épouse la photographie réelle et sa composition." },
    en: { category: "SPACES / INTERIORS", title: "Every space has a voice.", detail: "One piece, one texture, a story to live in.", chapter: "A space tells a story", note: "The narrative follows the real photograph and its composition." }
  },
  {
    id: "signature", image: "/themes/accessories-v1-960.webp", theme: "plum", number: "03",
    link: "/themes/accessories-signature",
    fr: { category: "OBJETS / SIGNATURE", title: "Une présence inoubliable.", detail: "Des lignes singulières. Une envie de regarder encore.", chapter: "La forme prend position", note: "Le produit reste lisible, accessible et toujours explorable." },
    en: { category: "OBJECTS / SIGNATURE", title: "A presence to remember.", detail: "A distinct silhouette. A reason to look twice.", chapter: "Form makes a statement", note: "The product remains legible, accessible and easy to explore." }
  }
];

const text = {
  fr: {
    label: "COMMERCE FACTORY / ÉTUDE VISUELLE 001",
    disclaimer: "Prototype artistique · Produits fictifs · Aucun achat possible ici",
    back: "Retour aux thèmes",
    eyebrow: "L'ART DE MONTRER",
    start: "Les objets",
    end: "prennent vie.",
    introduction: "Pas une boutique de plus. Une façon nouvelle de raconter ce que l'on vend.",
    explore: "Explorer ce concept",
    prev: "Produit précédent",
    next: "Produit suivant",
    image: "Produit fictif présenté en scène",
    scene: "CHOISIR UNE SCÈNE",
    discoveries: "Un objet. Trois univers. Une même exigence.",
    discoveriesLead: "L'expérience peut être singulière sans compliquer l'achat. Ici, les produits sont fictifs : les parcours commerciaux restent ceux de Commerce Factory.",
    detail: "VOIR LA COMPOSITION EXISTANTE",
    chapters: "L'EXPÉRIENCE / TROIS MOUVEMENTS",
    closing: "La vitrine ne devrait jamais voler la vedette au produit.",
    closingLead: "Ce laboratoire montre une direction artistique originale : une narration, des scènes et des interactions légères. Ce n'est pas encore un thème marchand.",
    finish: "Revenir à la bibliothèque",
    lab: "LAB / 001"
  },
  en: {
    label: "COMMERCE FACTORY / VISUAL STUDY 001",
    disclaimer: "Art-direction prototype · Fictional products · No purchasing here",
    back: "Back to themes",
    eyebrow: "THE ART OF PRESENTATION",
    start: "Objects",
    end: "come alive.",
    introduction: "Not just another storefront. A new way to tell a product's story.",
    explore: "Explore the concept",
    prev: "Previous product",
    next: "Next product",
    image: "Fictional product displayed in a scene",
    scene: "CHOOSE A SCENE",
    discoveries: "One object at a time. Three worlds. One standard.",
    discoveriesLead: "A distinctive experience should not complicate buying. These are fictional products; Commerce Factory's real purchasing flows remain unchanged.",
    detail: "VIEW THE EXISTING COMPOSITION",
    chapters: "THE EXPERIENCE / THREE MOVEMENTS",
    closing: "A storefront should never outshine the product.",
    closingLead: "This lab explores original art direction through narrative, scenes and lightweight interactions. It is not yet a merchant theme.",
    finish: "Back to the library",
    lab: "LAB / 001"
  }
} as const;

export default function CinematicProductStory() {
  const [language, setLanguage] = useState<Language>("fr");
  const [selected, setSelected] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const scene = scenes[selected];
  const t = text[language];
  const product = scene[language];
  useEffect(() => {
    document.title = "Cinematic Product Story — Commerce Factory Lab";
    document.documentElement.lang = language;
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    robots?.setAttribute("content", "noindex,nofollow");
  }, [language]);

  function moveStage(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !stage.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    stage.current.style.setProperty("--studio-px", String(x));
    stage.current.style.setProperty("--studio-py", String(y));
  }

  function resetStage() {
    stage.current?.style.setProperty("--studio-px", "0");
    stage.current?.style.setProperty("--studio-py", "0");
  }

  return <main className="cinematic-lab" data-tone={scene.theme}>
    <a className="cinematic-skip" href="#cinematic-content">{language === "fr" ? "Aller au contenu" : "Skip to content"}</a>
    <header className="cinematic-nav">
      <a className="cinematic-wordmark" href="/themes" aria-label="Commerce Factory · Theme library">C<span>/</span>F <small>LABORATORY</small></a>
      <span className="cinematic-nav-label">{t.lab}</span>
      <div className="cinematic-nav-actions">
        <div className="cinematic-lang" role="group" aria-label="Language / Langue">
          {(["fr", "en"] as const).map(key => <button type="button" key={key} aria-pressed={key === language} onClick={() => setLanguage(key)}>{key.toUpperCase()}</button>)}
        </div>
        <a href="/themes">{t.back} <span aria-hidden="true">↗</span></a>
      </div>
    </header>
    <div className="cinematic-content" id="cinematic-content">
      <section className="cinematic-hero" aria-labelledby="cinematic-title">
        <div className="cinematic-hero-copy">
          <span className="cinematic-eyebrow"><span className="cinematic-dot" /> {t.label}</span>
          <p className="cinematic-overline">{t.eyebrow}</p>
          <h1 id="cinematic-title">{t.start}<em>{t.end}</em></h1>
          <p className="cinematic-intro">{t.introduction}</p>
          <a href="#cinematic-scenes" className="cinematic-cta">{t.explore} <span aria-hidden="true">↘</span></a>
        </div>
        <div className="cinematic-stage" ref={stage} onPointerMove={moveStage} onPointerLeave={resetStage} aria-label={product.title}>
          <span className="cinematic-stage-number" aria-hidden="true">{scene.number}<small> / 03</small></span>
          <span className="cinematic-stage-type" aria-hidden="true">ATELIER / OBJECTS</span>
          <div className="cinematic-orbit cinematic-orbit-one" aria-hidden="true" />
          <div className="cinematic-orbit cinematic-orbit-two" aria-hidden="true" />
          <span className="cinematic-floor" aria-hidden="true" />
          <img key={scene.id} src={scene.image} alt={t.image + " — " + product.category} className="cinematic-object" loading="eager" fetchPriority="high" width="960" height="960"/>
          <span className="cinematic-stage-vertical" aria-hidden="true">DESIGNED TO BE DISCOVERED · 2026</span>
        </div>
        <div className="cinematic-side-caption"><span>{t.disclaimer}</span><span aria-hidden="true">↓ SCROLL TO DISCOVER</span></div>
      </section>
      <section id="cinematic-scenes" className="cinematic-selection" aria-labelledby="cinematic-selection-heading">
        <div className="cinematic-selection-header">
          <div><span className="cinematic-index">01 — 03 / THE COLLECTION</span><h2 id="cinematic-selection-heading">{t.discoveries}</h2><p>{t.discoveriesLead}</p></div>
          <div className="cinematic-arrows"><button type="button" aria-label={t.prev} onClick={() => setSelected((selected + scenes.length - 1) % scenes.length)}>←</button><button type="button" aria-label={t.next} onClick={() => setSelected((selected + 1) % scenes.length)}>→</button></div>
        </div>
        <div className="cinematic-scene-choice" role="group" aria-label={t.scene}>
          {scenes.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><small>{item.number} / {item[language].category}</small><span>{item[language].title}</span><span aria-hidden="true">{selected === index ? "●" : "↗"}</span></button>)}
        </div>
        <article className="cinematic-selected-story" aria-live="polite">
          <p className="cinematic-index">{product.category} / {scene.number}</p>
          <h3>{product.chapter}</h3>
          <p>{product.detail}</p>
          <a href={scene.link}>{t.detail} <span aria-hidden="true">↗</span></a>
        </article>
      </section>
      <section className="cinematic-editorial" aria-labelledby="cinematic-editorial-heading">
        <span className="cinematic-index">{t.chapters}</span>
        <div className="cinematic-editorial-grid">
          {scenes.map((item) => <article key={item.id} className="cinematic-editorial-card"><div className="cinematic-editorial-photo"><img src={item.image} loading="lazy" width="960" height="960" alt={item[language].category}/></div><div className="cinematic-editorial-details"><small>{item.number} / {item[language].category}</small><h3>{item[language].chapter}</h3><p>{item[language].note}</p></div></article>)}
        </div>
      </section>
      <footer className="cinematic-footer"><span className="cinematic-index">COMMERCE FACTORY — DESIGN LABORATORY</span><h2>{t.closing}</h2><p>{t.closingLead}</p><a href="/themes">{t.finish} <span aria-hidden="true">↗</span></a><small>{t.disclaimer}</small></footer>
    </div>
  </main>;
}
