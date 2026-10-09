import { useEffect, useMemo } from "react";
import "./demo-storefront.css";

type DemoProduct = {
  name: string;
  category: string;
  priceLabel: string;
  detail: string;
  accent: string;
  emoji: string;
};

type DemoMerchant = {
  slug: string;
  name: string;
  initials: string;
  location: string;
  description: string;
  whatsappNumber: string;
  catalogUrl: string;
  publicSourceLabel: string;
  trustPoints: string[];
  products: DemoProduct[];
};

const merchants: Record<string, DemoMerchant> = {
  "faya-computer": {
    slug: "faya-computer",
    name: "Faya Computer Technologic",
    initials: "FC",
    location: "Yaoundé • Mfoundi Mall · Douala • Bonamoussadi",
    description:
      "Ordinateurs portables et stations de travail pour étudiants, ingénieurs, créatifs et entreprises.",
    whatsappNumber: "237699176612",
    catalogUrl: "https://wa.me/c/237699176612",
    publicSourceLabel: "Catalogue et offres publiques observées en septembre 2026",
    trustPoints: [
      "Machines testées avant vente",
      "Garantie annoncée selon les modèles",
      "Livraison Yaoundé & Douala"
    ],
    products: [
      {
        name: "Lenovo ThinkPad P1 Gen 6",
        category: "Workstation",
        priceLabel: "699 900 FCFA",
        detail: "Core i7 13e gen • 32 Go RAM • SSD 512 Go • RTX A1000",
        accent: "workstation",
        emoji: "💻"
      },
      {
        name: "MacBook Pro 16” — 2019",
        category: "Apple",
        priceLabel: "499 900 FCFA",
        detail: "Core i7 • 16 Go RAM • SSD 512 Go • Touch Bar",
        accent: "apple",
        emoji: "⌘"
      },
      {
        name: "Laptops étudiants",
        category: "Études",
        priceLabel: "Dès 89 900 FCFA",
        detail: "SSD rapide • format mobile • garantie annoncée",
        accent: "student",
        emoji: "🎓"
      },
      {
        name: "Dell Precision",
        category: "Ingénierie",
        priceLabel: "Voir le catalogue",
        detail: "Pensé pour AutoCAD, SolidWorks, CATIA et Revit",
        accent: "engineering",
        emoji: "⚙️"
      },
      {
        name: "HP EliteBook",
        category: "Business",
        priceLabel: "Voir le catalogue",
        detail: "PC professionnel pour cadres et entreprises",
        accent: "business",
        emoji: "🏢"
      },
      {
        name: "MacBook Pro M1 / M3",
        category: "Création",
        priceLabel: "Voir le catalogue",
        detail: "Création, vidéo, design et développement Apple",
        accent: "creator",
        emoji: "🎬"
      }
    ]
  },
  "la-boutique-de-gaby": {
    slug: "la-boutique-de-gaby",
    name: "La Boutique de Gaby",
    initials: "GB",
    location: "Yaoundé • Mfoundi Mall · Douala • Beedi",
    description:
      "Beauté, nail art, maquillage et accessoires réunis dans un catalogue WhatsApp déjà très actif.",
    whatsappNumber: "237687054262",
    catalogUrl: "https://wa.me/c/237687054262",
    publicSourceLabel: "Produits cités dans des publications publiques de septembre 2026",
    trustPoints: [
      "Catalogue WhatsApp actif",
      "Points de vente à Yaoundé et Douala",
      "Tutoriels et conseils produits réguliers"
    ],
    products: [
      {
        name: "Airbrush Nail Art",
        category: "Nail art",
        priceLabel: "Prix sur WhatsApp",
        detail: "Pour dégradés, motifs précis et créations détaillées",
        accent: "nails",
        emoji: "💅"
      },
      {
        name: "Blooming Gel",
        category: "Nail art",
        priceLabel: "Prix sur WhatsApp",
        detail: "Pour des effets fluides et artistiques",
        accent: "bloom",
        emoji: "🌸"
      },
      {
        name: "Gel 3D",
        category: "Nail art",
        priceLabel: "Prix sur WhatsApp",
        detail: "Décorations en relief et designs créatifs",
        accent: "gel",
        emoji: "✨"
      },
      {
        name: "Poudre néon & vernis fluorescent",
        category: "Couleurs",
        priceLabel: "Prix sur WhatsApp",
        detail: "Teintes audacieuses pour manucures fluorescentes",
        accent: "neon",
        emoji: "🌈"
      },
      {
        name: "Beauty blenders & éponges",
        category: "Make-up",
        priceLabel: "Prix sur WhatsApp",
        detail: "Accessoires pour application et finition maquillage",
        accent: "makeup",
        emoji: "💄"
      },
      {
        name: "Hair wax & accessoires baby hair",
        category: "Cheveux",
        priceLabel: "Prix sur WhatsApp",
        detail: "Wax, peigne baby hair, peigne à queue et brillantine",
        accent: "hair",
        emoji: "🪮"
      }
    ]
  },
  "love-shop": {
    slug: "love-shop",
    name: "LOVE SHOP",
    initials: "LS",
    location: "Yaoundé • Awae Escalier",
    description:
      "Vêtements, chaussures et accessoires pour filles et garçons de 0 à 15 ans.",
    whatsappNumber: "237656595525",
    catalogUrl: "https://wa.me/c/237656595525",
    publicSourceLabel: "Sélection issue d'offres et catégories publiques de 2026",
    trustPoints: [
      "Catalogue WhatsApp public",
      "Chaîne WhatsApp et groupe VIP",
      "Nouveautés annoncées régulièrement"
    ],
    products: [
      {
        name: "Sacs de classe",
        category: "Rentrée",
        priceLabel: "Prix dans le catalogue",
        detail: "Sélection rentrée scolaire",
        accent: "school",
        emoji: "🎒"
      },
      {
        name: "Gourdes enfants",
        category: "Rentrée",
        priceLabel: "Prix dans le catalogue",
        detail: "Accessoires pratiques pour l'école",
        accent: "bottle",
        emoji: "🥤"
      },
      {
        name: "Gamelles & sacs gamelles",
        category: "Rentrée",
        priceLabel: "Prix dans le catalogue",
        detail: "Repas et goûters pour l'école",
        accent: "lunch",
        emoji: "🍱"
      },
      {
        name: "Montre solaire waterproof",
        category: "Accessoires",
        priceLabel: "Prix dans le catalogue",
        detail: "Accessoire enfant annoncé dans la campagne rentrée",
        accent: "watch",
        emoji: "⌚"
      },
      {
        name: "Vêtements enfants",
        category: "Mode",
        priceLabel: "Voir le catalogue",
        detail: "Filles et garçons • 0 à 15 ans",
        accent: "clothes",
        emoji: "👕"
      },
      {
        name: "Chaussures enfants",
        category: "Chaussures",
        priceLabel: "Voir le catalogue",
        detail: "Modèles confortables et habillés",
        accent: "shoes",
        emoji: "👟"
      }
    ]
  }
};

function parseDemoSlug(): string | null {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "demo" && parts[1] ? decodeURIComponent(parts[1]) : null;
}

function whatsappHref(merchant: DemoMerchant, product?: DemoProduct): string {
  const intro = product
    ? `Bonjour, je suis intéressé(e) par « ${product.name} » vu dans votre aperçu Commerce Factory. Pouvez-vous me confirmer le prix et la disponibilité ?`
    : "Bonjour, je souhaite découvrir vos produits et confirmer les disponibilités.";
  return `https://wa.me/${merchant.whatsappNumber}?text=${encodeURIComponent(intro)}`;
}

function DemoProductCard({
  merchant,
  product
}: {
  merchant: DemoMerchant;
  product: DemoProduct;
}) {
  return (
    <article className="demo-product-card">
      <div className={`demo-product-art demo-product-art--${product.accent}`}>
        <span aria-hidden="true">{product.emoji}</span>
        <small>APERÇU PRODUIT</small>
      </div>
      <div className="demo-product-copy">
        <span className="demo-product-category">{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.detail}</p>
        <strong>{product.priceLabel}</strong>
        <a
          href={whatsappHref(merchant, product)}
          target="_blank"
          rel="noreferrer"
          className="demo-whatsapp-button"
        >
          Commander sur WhatsApp <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

export default function DemoStorefrontApp() {
  const slug = parseDemoSlug();
  const merchant = slug ? merchants[slug] : undefined;

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) {
      robots.content = "noindex,nofollow,noarchive,nosnippet";
    } else {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex,nofollow,noarchive,nosnippet";
      document.head.appendChild(meta);
    }
    document.title = merchant
      ? `${merchant.name} — aperçu privé Commerce Factory`
      : "Aperçu privé — Commerce Factory";
  }, [merchant]);

  const categories = useMemo(
    () => merchant ? [...new Set(merchant.products.map((product) => product.category))] : [],
    [merchant]
  );

  if (!merchant) {
    return (
      <main className="demo-missing">
        <strong>Commerce Factory</strong>
        <h1>Aperçu indisponible</h1>
        <p>Cette démonstration privée n’existe pas ou n’est plus active.</p>
      </main>
    );
  }

  return (
    <div className="demo-shell">
      <div className="demo-disclaimer">
        <strong>Démo privée non officielle.</strong>
        <span>
          Aperçu Commerce Factory construit à partir d’informations publiques pour présenter le concept à {merchant.name}.
        </span>
      </div>

      <header className="demo-header">
        <a className="demo-brand" href={"/demo/" + merchant.slug} aria-label={merchant.name}>
          <span>{merchant.initials}</span>
          <div>
            <strong>{merchant.name}</strong>
            <small>{merchant.location}</small>
          </div>
        </a>
        <div className="demo-header-actions">
          <a className="demo-catalog-link" href={merchant.catalogUrl} target="_blank" rel="noreferrer">
            Catalogue WhatsApp
          </a>
          <a className="demo-primary-button" href={whatsappHref(merchant)} target="_blank" rel="noreferrer">
            Écrire sur WhatsApp
          </a>
        </div>
      </header>

      <main>
        <section className="demo-hero">
          <div className="demo-hero-copy">
            <span className="demo-overline">APERÇU DE BOUTIQUE • COMMERCE FACTORY</span>
            <h1>{merchant.name}</h1>
            <p>{merchant.description}</p>
            <div className="demo-hero-actions">
              <a className="demo-primary-button demo-primary-button--large" href="#catalogue">
                Voir la sélection
              </a>
              <a className="demo-secondary-button" href={merchant.catalogUrl} target="_blank" rel="noreferrer">
                Ouvrir le catalogue WhatsApp
              </a>
            </div>
            <div className="demo-trust-list" aria-label="Informations publiques">
              {merchant.trustPoints.map((point) => <span key={point}>✓ {point}</span>)}
            </div>
          </div>

          <div className="demo-phone-preview" aria-label="Aperçu mobile">
            <div className="demo-phone-frame">
              <div className="demo-phone-notch" />
              <div className="demo-phone-head">
                <span>{merchant.initials}</span>
                <div>
                  <strong>{merchant.name}</strong>
                  <small>Catalogue WhatsApp connecté</small>
                </div>
              </div>
              <div className="demo-phone-feature">
                <span aria-hidden="true">{merchant.products[0]?.emoji}</span>
                <small>{merchant.products[0]?.category}</small>
                <strong>{merchant.products[0]?.name}</strong>
                <p>{merchant.products[0]?.priceLabel}</p>
              </div>
              <a href={whatsappHref(merchant, merchant.products[0])} target="_blank" rel="noreferrer">
                Continuer sur WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="demo-catalogue" id="catalogue">
          <div className="demo-section-heading">
            <div>
              <span className="demo-overline">SÉLECTION DE DÉMONSTRATION</span>
              <h2>Un catalogue plus clair avant la conversation WhatsApp.</h2>
            </div>
            <div className="demo-category-pills">
              {categories.map((category) => <span key={category}>{category}</span>)}
            </div>
          </div>

          <p className="demo-source-note">
            {merchant.publicSourceLabel}. Les produits ou prix non confirmés publiquement sont volontairement indiqués comme « prix sur WhatsApp ».
          </p>

          <div className="demo-product-grid">
            {merchant.products.map((product) => (
              <DemoProductCard key={product.name} merchant={merchant} product={product} />
            ))}
          </div>
        </section>

        <section className="demo-conversion-band">
          <div>
            <span className="demo-overline">PARCOURS CLIENT</span>
            <h2>Le client choisit d’abord. Le chat commence avec du contexte.</h2>
            <p>
              Commerce Factory ne remplace pas WhatsApp : il prépare mieux la conversation avant qu’elle commence.
            </p>
          </div>
          <a className="demo-primary-button demo-primary-button--large" href={whatsappHref(merchant)} target="_blank" rel="noreferrer">
            Tester le parcours WhatsApp
          </a>
        </section>
      </main>

      <footer className="demo-footer">
        <span>Prototype privé Commerce Factory by Trigenys</span>
        <span>Non affilié officiellement à {merchant.name} à ce stade.</span>
      </footer>
    </div>
  );
}
