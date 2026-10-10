import { useState } from "react";
import "./commerce-hero.css";

type Language = "fr" | "en";
type HeroProduct = {
  id: "fashion" | "tech" | "beauty";
  shop: string;
  image: string;
  width: number;
  height: number;
  product: { fr: string; en: string };
  price: { fr: string; en: string };
  category: { fr: string; en: string };
  variant: { fr: string; en: string };
};

const examples: readonly HeroProduct[] = [
  {
    id: "fashion",
    shop: "Maison Noya",
    image: "/landing/fashion-960.webp",
    width: 512, height: 286,
    product: { fr: "Ensemble deux pièces en lin", en: "Linen two-piece" },
    price: { fr: "35 000 FCFA", en: "35,000 FCFA" },
    category: { fr: "Mode", en: "Fashion" },
    variant: { fr: "Naturel", en: "Natural" }
  },
  {
    id: "tech",
    shop: "TechPulse",
    image: "/landing/electronics-960.webp",
    width: 512, height: 279,
    product: { fr: "Sony WH-1000XM5", en: "Sony WH-1000XM5" },
    price: { fr: "230 000 FCFA", en: "230,000 FCFA" },
    category: { fr: "Tech", en: "Tech" },
    variant: { fr: "Noir", en: "Black" }
  },
  {
    id: "beauty",
    shop: "Glow Room",
    image: "/landing/beauty-960.webp",
    width: 512, height: 279,
    product: { fr: "Kit éclat hydratant", en: "Hydration glow kit" },
    price: { fr: "22 500 FCFA", en: "22,500 FCFA" },
    category: { fr: "Beauté", en: "Beauty" },
    variant: { fr: "Kit", en: "Kit" }
  }
];

const copy = {
  fr: {
    eyebrow: "LE COMMERCE, VERSION VITRINE",
    titleOne: "Montrez vos produits.",
    titleTwo: "Déclenchez la conversation.",
    lead: "Une boutique mobile qui donne envie, des prix clairs et des demandes WhatsApp avec le bon produit déjà identifié. Vous gardez la relation client.",
    cta: "Créer ma boutique",
    secondary: "Voir comment ça fonctionne",
    underneath: "Pas de code. Pas de paiement inventé. Votre boutique, votre WhatsApp.",
    screen: "Boutique fictive en démonstration",
    discover: "Découvrez une vitrine",
    choose: "Choisir une boutique fictive",
    preview: "Aperçu boutique",
    product: "Produit",
    variant: "Variante",
    order: "Demande préparée",
    inquiry: "Bonjour, je suis intéressé(e) par",
    inquiryEnd: "Est-il disponible ?",
    chatMeta: "Simulation · message non envoyé",
    flowOne: "01 / Le produit",
    flowTwo: "02 / La vitrine",
    flowThree: "03 / WhatsApp",
    proof: "Un clic qui a du contexte.",
    disclaimer: "Les marques et produits présentés ici illustrent des boutiques fictives. Aucun résultat marchand réel."
  },
  en: {
    eyebrow: "COMMERCE, WITH A SHOPFRONT",
    titleOne: "Show your products.",
    titleTwo: "Start the conversation.",
    lead: "An inviting mobile store, clear prices, and WhatsApp inquiries that already identify the product. You keep the customer relationship.",
    cta: "Create my store",
    secondary: "See how it works",
    underneath: "No code. No imaginary checkout. Your store, your WhatsApp.",
    screen: "Fictional demo storefront",
    discover: "Explore a storefront",
    choose: "Choose a fictional storefront",
    preview: "Storefront preview",
    product: "Product",
    variant: "Variant",
    order: "Prepared inquiry",
    inquiry: "Hello, I'm interested in",
    inquiryEnd: "Is it available?",
    chatMeta: "Simulation · message not sent",
    flowOne: "01 / Product",
    flowTwo: "02 / Storefront",
    flowThree: "03 / WhatsApp",
    proof: "A click with context.",
    disclaimer: "The brands and products shown illustrate fictional storefronts. No real merchant results."
  }
} as const;

export default function CommerceHero({ language }: { language: Language }) {
  const [selected, setSelected] = useState<HeroProduct["id"]>("fashion");
  const t = copy[language];
  const example = examples.find((item) => item.id === selected) ?? examples[0];
  const message = t.inquiry + " « " + example.product[language] + " » (" +
    example.variant[language] + ") — " + example.price[language] + ". " + t.inquiryEnd;

  return (
    <section className="section cfh-section" aria-labelledby="cfh-heading">
      <div className="cfh-orb cfh-orb-one" aria-hidden="true" />
      <div className="cfh-orb cfh-orb-two" aria-hidden="true" />

      <div className="cfh-layout">
        <div className="cfh-copy">
          <p className="cfh-eyebrow"><span className="cfh-symbol" aria-hidden="true">✳</span>{t.eyebrow}</p>
          <h1 id="cfh-heading">
            <span>{t.titleOne}</span>
            <em>{t.titleTwo}</em>
          </h1>
          <p className="cfh-lead">{t.lead}</p>
          <div className="cfh-actions">
            <a href="/app" className="cfh-primary">{t.cta}<span aria-hidden="true">↗</span></a>
            <a href="#whatsapp" className="cfh-secondary">{t.secondary}<span aria-hidden="true">↘</span></a>
          </div>
          <p className="cfh-honesty"><span aria-hidden="true">✓</span>{t.underneath}</p>
          <div className="cfh-micro-flow" aria-label={language === "fr" ? "Parcours commercial" : "Commerce journey"}>
            <span>{t.flowOne}</span><span className="cfh-flow-line" aria-hidden="true" />
            <span>{t.flowTwo}</span><span className="cfh-flow-line" aria-hidden="true" />
            <span>{t.flowThree}</span>
          </div>
        </div>

        <div className={"cfh-stage cfh-stage--" + selected} role="group" aria-label={t.discover}>
          <div className="cfh-stage-header">
            <span className="cfh-stage-index">CF / 001</span>
            <span className="cfh-stage-demo"><i aria-hidden="true" />{t.screen}</span>
          </div>
          <div className="cfh-ghost" aria-hidden="true">SHOW / SELL</div>
          <div className="cfh-photo-wrap">
            <img
              key={example.id}
              className="cfh-photo"
              src={example.image}
              width={example.width}
              height={example.height}
              alt={example.product[language]}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
            <span className="cfh-category-vertical">{example.category[language]} / 2026</span>
          </div>

          <div className="cfh-product-panel">
            <div className="cfh-panel-top">
              <span className="cfh-shop-mark" aria-hidden="true">{example.shop.slice(0, 1)}</span>
              <div><span>{t.preview}</span><strong>{example.shop}</strong></div>
              <span className="cfh-panel-external" aria-hidden="true">↗</span>
            </div>
            <p>{t.product}</p>
            <strong className="cfh-product-name">{example.product[language]}</strong>
            <div className="cfh-panel-bottom"><span>{example.price[language]}</span><small>{t.variant} : {example.variant[language]}</small></div>
          </div>

          <div className="cfh-message">
            <div className="cfh-message-head"><span className="cfh-message-logo" aria-hidden="true">◉</span><strong>WhatsApp</strong><span aria-hidden="true">✓</span></div>
            <span className="cfh-message-label">{t.order}</span>
            <p aria-live="polite">{message}</p>
            <small>{t.chatMeta}</small>
          </div>

          <div className="cfh-picker" role="group" aria-label={t.choose}>
            {examples.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={"cfh-pick" + (selected === item.id ? " is-active" : "")}
                aria-pressed={selected === item.id}
                onClick={() => setSelected(item.id)}
                aria-label={item.shop + " — " + item.category[language]}
              >
                <span>0{i + 1}</span><strong>{item.category[language]}</strong>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cfh-endnote">
        <span className="cfh-endnote-left"><span aria-hidden="true">↗</span>{t.proof}</span>
        <span>{t.disclaimer}</span>
        <a href="#showcase">{language === "fr" ? "Explorer les exemples" : "Explore examples"} <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}
