import { useState } from "react";
import "./commerce-journey.css";

type Language = "fr" | "en";
type Stage = 0 | 1 | 2 | 3;
type Product = { id: string; image: string; fr: string; en: string; priceFr: string; priceEn: string; variant: { fr: string; en: string }; category: { fr: string; en: string } };

const products: Product[] = [
  { id: "audio", image: "/landing/electronics-960.webp", fr: "Sony WH-1000XM5", en: "Sony WH-1000XM5", priceFr: "230 000 FCFA", priceEn: "230,000 FCFA", variant: { fr: "Noir", en: "Black" }, category: { fr: "Audio", en: "Audio" } },
  { id: "fashion", image: "/landing/fashion-960.webp", fr: "Ensemble deux pièces en lin", en: "Linen two-piece", priceFr: "35 000 FCFA", priceEn: "35,000 FCFA", variant: { fr: "Naturel", en: "Natural" }, category: { fr: "Mode", en: "Fashion" } },
  { id: "beauty", image: "/landing/beauty-960.webp", fr: "Kit éclat hydratant", en: "Hydration glow kit", priceFr: "22 500 FCFA", priceEn: "22,500 FCFA", variant: { fr: "Kit", en: "Kit" }, category: { fr: "Beauté", en: "Beauty" } }
];

const copy = {
  fr: {
    eyebrow: "LE DÉCLIC · WHATSAPP-FIRST", titleOne: "Un produit repéré.", titleTwo: "Une conversation qui commence.",
    intro: "Fini le « bonjour, c’est combien ? » sans contexte. Le client voit le produit, son prix et sa variante avant de préparer une demande précise.",
    steps: [
      ["Le coup de cœur", "Un produit attire l’œil dans la vitrine."],
      ["Les détails", "Photo, prix et variante restent visibles."],
      ["Le passage", "L’intention devient un message prêt à envoyer."],
      ["La discussion", "Le commerçant reprend la main sur WhatsApp."]
    ],
    label: "PARCOURS INTERACTIF", browser: "commercefactory.shop / techpulse", fake: "Concept fictif · Douala",
    catalog: "Sélection de produits", selected: "Produit sélectionné", variant: "Variante", handoff: "Aperçu de la transition vers WhatsApp",
    messageReady: "Message préparé", buyer: "Demande du client · Simulation", replyLabel: "Réponse commerçant · Illustration",
    reply: "Bonjour ! Je vous confirme la disponibilité ici.", footer: "Démonstration fictive. Aucun message envoyé, aucune vente supposée.",
    next: "Étape suivante", restart: "Recommencer", select: "Choisir ce produit", prepare: "Préparer le message",
    create: "Créer ma boutique", tagline: "Du catalogue à la conversation", chatPlaceholder: "Aperçu non envoyé",
    hint: "Choisissez une étape du parcours ou un autre produit.",
    inquiryBefore: "Bonjour, je souhaite en savoir plus sur", inquiryAfter: "vu chez TechPulse. Est-il disponible ?",
    note: "Paiement et livraison restent gérés par le commerçant dans ce MVP."
  },
  en: {
    eyebrow: "THE MOMENT · WHATSAPP-FIRST", titleOne: "A product discovered.", titleTwo: "A conversation started.",
    intro: "No more context-free “hello, how much?” questions. The shopper sees the product, its price and variant before preparing a useful inquiry.",
    steps: [
      ["The discovery", "A product stands out in the storefront."],
      ["The details", "Image, price and variant stay in view."],
      ["The handoff", "Shopping intent becomes a ready-to-send message."],
      ["The conversation", "The merchant takes over in WhatsApp."]
    ],
    label: "INTERACTIVE WALKTHROUGH", browser: "commercefactory.shop / techpulse", fake: "Fictional concept · Douala",
    catalog: "Featured products", selected: "Selected product", variant: "Variant", handoff: "WhatsApp handoff preview",
    messageReady: "Message prepared", buyer: "Customer inquiry · Simulation", replyLabel: "Merchant reply · Illustration",
    reply: "Hello! I'll confirm availability here.", footer: "Fictional demonstration. No message sent and no completed sale implied.",
    next: "Next step", restart: "Start again", select: "Choose this product", prepare: "Prepare the message",
    create: "Create my store", tagline: "From catalog to conversation", chatPlaceholder: "Unsent preview",
    hint: "Choose a journey step or another product.",
    inquiryBefore: "Hello, I'd like to know more about", inquiryAfter: "at TechPulse. Is it available?",
    note: "Payment and delivery remain in the merchant's own process for the MVP."
  }
} as const;

export default function CommerceJourney({ language }: { language: Language }) {
  const [stage, setStage] = useState<Stage>(0);
  const [productId, setProductId] = useState("audio");
  const t = copy[language];
  const product = products.find((item) => item.id === productId) ?? products[0];
  const name = product[language];
  const price = language === "fr" ? product.priceFr : product.priceEn;
  const message = t.inquiryBefore + " « " + name + " » (" + product.variant[language] + ") — " + price + ", " + t.inquiryAfter;

  function selectProduct(id: string) {
    setProductId(id);
    setStage(1);
  }

  function next() {
    setStage((current) => (current === 3 ? 0 : (current + 1) as Stage));
  }

  return (
    <section className="section journey-section" id="whatsapp" aria-labelledby="journey-title">
      <div className="journey-glow" aria-hidden="true" />
      <div className="journey-intro">
        <div>
          <p className="journey-overline"><span aria-hidden="true">✳</span> {t.eyebrow}</p>
          <h2 id="journey-title">{t.titleOne} <em>{t.titleTwo}</em></h2>
        </div>
        <p className="journey-lede">{t.intro}</p>
      </div>
      <div className="journey-stage" data-stage={stage}>
        <div className="journey-controls">
          <span className="journey-scene-label"><span className="journey-live-dot" aria-hidden="true" /> {t.label}</span>
          <span className="journey-progress" aria-hidden="true">0{stage + 1} <i /> 04</span>
        </div>
        <div className="journey-grid">
          <div className="journey-story">
            <div className="journey-step-list" role="group" aria-label={t.hint}>
              {t.steps.map(([title, description], index) => (
                <button key={title} type="button"
                  className={stage === index ? "journey-step is-active" : "journey-step"}
                  onClick={() => setStage(index as Stage)}
                  aria-pressed={stage === index}>
                  <span className="journey-step-index">0{index + 1}</span>
                  <span className="journey-step-content"><strong>{title}</strong><small>{description}</small></span>
                  <span className="journey-step-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="journey-story-footer">
              <button type="button" className="journey-next" onClick={next}>
                {stage === 3 ? t.restart : t.next} <span aria-hidden="true">↗</span>
              </button>
              <small>{t.note}</small>
            </div>
          </div>

          <div className="journey-visual" role="group" aria-label={t.handoff}>
            <div className="journey-browser">
              <div className="journey-browser-top">
                <span className="journey-browser-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="journey-browser-address">{t.browser}</span>
                <span aria-hidden="true">↗</span>
              </div>
              <div className="journey-store">
                <div className="journey-store-head">
                  <span className="journey-monogram">TP<span aria-hidden="true">✦</span></span>
                  <span className="journey-store-details"><strong>TechPulse</strong><small>{t.fake}</small></span>
                  <span className="journey-xaf">XAF</span>
                </div>
                <p className="journey-catalog-label">{stage === 0 ? t.catalog : t.selected}</p>
                <div className="journey-product-main">
                  <img src={product.image} alt={name} width={512} height={279} loading="eager" decoding="async" />
                  <div className="journey-product-info">
                    <span>{product.category[language]}</span>
                    <strong>{name}</strong>
                    <p>{price}</p>
                    <small>{t.variant} : {product.variant[language]}</small>
                  </div>
                </div>
                <div className="journey-product-choices" role="group" aria-label={t.catalog}>
                  {products.map((item) => (
                    <button type="button" key={item.id}
                      className={productId === item.id ? "journey-product-choice is-selected" : "journey-product-choice"}
                      onClick={() => selectProduct(item.id)}
                      aria-pressed={productId === item.id}
                      aria-label={t.select + " : " + item[language]}>
                      <img src={item.image} alt="" width={84} height={64} loading="eager" decoding="async" />
                      <span>{item.category[language]}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="journey-product-action" onClick={() => setStage(2)}>
                  <span aria-hidden="true">◉</span> {t.prepare} <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
            <div className={stage >= 2 ? "journey-message is-visible" : "journey-message"}>
              <div className="journey-message-header">
                <span className="journey-message-logo" aria-hidden="true">◉</span>
                <div><strong>WhatsApp</strong><small>{t.messageReady}</small></div>
                <span className="journey-message-check" aria-hidden="true">✓</span>
              </div>
              <div className="journey-message-body" aria-live="polite">
                <small>{t.buyer}</small>
                <p>{message}</p>
                {stage === 3 && <div className="journey-message-reply"><small>{t.replyLabel}</small><p>{t.reply}</p></div>}
              </div>
              <div className="journey-message-bottom"><span>{t.chatPlaceholder}</span><span aria-hidden="true">➤</span></div>
            </div>
          </div>
        </div>
        <div className="journey-bottom">
          <span><span aria-hidden="true">✧</span> {t.tagline}</span>
          <span>{t.footer}</span>
          <a href="/app">{t.create} <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  );
}
