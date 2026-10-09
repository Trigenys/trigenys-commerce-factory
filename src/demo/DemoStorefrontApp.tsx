import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import "./demo-storefront.css";

type DemoProduct = {
  name: string;
  category: string;
  priceLabel: string;
  detail: string;
  imageUrl: string;
  imageFit?: "cover" | "contain";
};

type DemoMerchant = {
  slug: string;
  name: string;
  initials: string;
  logoUrl?: string;
  location: string;
  eyebrow: string;
  headline: string;
  description: string;
  whatsappNumber: string;
  catalogUrl: string;
  publicSourceLabel: string;
  trustPoints: string[];
  theme: {
    ink: string;
    primary: string;
    primaryDark: string;
    soft: string;
    accent: string;
  };
  products: DemoProduct[];
};

const merchants: Record<string, DemoMerchant> = {
  "faya-computer": {
    slug: "faya-computer",
    name: "Faya Computer Technologic",
    initials: "FC",
    location: "Yaoundé • Mfoundi Mall · Douala • Bonamoussadi",
    eyebrow: "PC • Workstations • Apple • Business",
    headline: "La bonne machine pour votre vrai usage.",
    description:
      "Une sélection plus lisible pour choisir selon le profil, le budget et les performances — puis confirmer directement sur WhatsApp.",
    whatsappNumber: "237699176612",
    catalogUrl: "https://wa.me/c/237699176612",
    publicSourceLabel: "Sélection de démonstration construite à partir d’offres et visuels publics Faya Computer.",
    trustPoints: [
      "Machines testées avant vente",
      "SAV physique en boutique",
      "Livraison Yaoundé & Douala"
    ],
    theme: {
      ink: "#101820",
      primary: "#0f5b78",
      primaryDark: "#08384b",
      soft: "#edf6fa",
      accent: "#74d4ee"
    },
    products: [
      {
        name: "MSI Gaming",
        category: "Gaming",
        priceLabel: "619 900 FCFA",
        detail: "Machine gaming présentée dans les visuels publics Faya Computer.",
        imageUrl: "https://businesslinkafrica.com/wp-content/uploads/2025/09/faya1g.jpg.webp"
      },
      {
        name: "Lenovo ThinkPad Yoga",
        category: "Business",
        priceLabel: "219 900 FCFA",
        detail: "ThinkPad convertible présenté dans les visuels publics de la boutique.",
        imageUrl: "https://businesslinkafrica.com/wp-content/uploads/2025/09/faya1e.jpg.webp"
      },
      {
        name: "Microsoft Surface",
        category: "Mobilité",
        priceLabel: "Voir le catalogue",
        detail: "Format premium et mobile pour travail, études et déplacements.",
        imageUrl: "https://businesslinkafrica.com/wp-content/uploads/2025/09/faya1d.jpg.webp"
      },
      {
        name: "Sélection Apple",
        category: "Apple",
        priceLabel: "Voir le catalogue",
        detail: "Produits Apple visibles dans la sélection publique Faya Computer.",
        imageUrl: "https://businesslinkafrica.com/wp-content/uploads/2025/09/faya1c.jpg.webp"
      }
    ]
  },
  "la-boutique-de-gaby": {
    slug: "la-boutique-de-gaby",
    name: "La Boutique de Gaby",
    initials: "GB",
    logoUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/logos/669f8ce0eee6e_1721732320_La%20boutique%20de%20Gaby%20%281%29.jpg",
    location: "Yaoundé • Mfoundi Mall · Douala • Beedi",
    eyebrow: "Nail art • Make-up • Accessoires",
    headline: "Tout pour créer, choisir et commander sans chercher dans le fil.",
    description:
      "Les produits sont présentés avec photo, prix et catégorie avant de passer sur WhatsApp pour confirmer la commande.",
    whatsappNumber: "237687054262",
    catalogUrl: "https://wa.me/c/237687054262",
    publicSourceLabel: "Produits, prix et visuels issus d’une fiche publique de La Boutique de Gaby.",
    trustPoints: [
      "Catalogue WhatsApp actif",
      "Yaoundé & Douala",
      "Large choix nail art"
    ],
    theme: {
      ink: "#28151f",
      primary: "#9d0b43",
      primaryDark: "#65072b",
      soft: "#fff0f5",
      accent: "#ff8db5"
    },
    products: [
      {
        name: "UV / LED SUN X7 220W",
        category: "Lampes",
        priceLabel: "10 000 FCFA",
        detail: "Lampe UV/LED pour manucure et séchage.",
        imageUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/7702/media/669f8d3f6803d_1721732415_La%20boutique%20de%20Gaby%20%287%29.jpg",
        imageFit: "contain"
      },
      {
        name: "Pinceau résine — taille 20",
        category: "Outils",
        priceLabel: "3 500 FCFA",
        detail: "Pinceau pour construction et travail de la résine.",
        imageUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/7702/media/669f8d4273238_1721732418_La%20boutique%20de%20Gaby%20%289%29.jpg",
        imageFit: "contain"
      },
      {
        name: "500 chablons dorés",
        category: "Nail art",
        priceLabel: "3 500 FCFA",
        detail: "Rouleau de chablons pour extensions et construction.",
        imageUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/7702/media/669f8d4690080_1721732422_La%20boutique%20de%20Gaby%20%2810%29.jpg",
        imageFit: "contain"
      },
      {
        name: "Liner gel bleu — 10 ml",
        category: "Gel",
        priceLabel: "1 000 FCFA",
        detail: "Gel liner pour détails et nail art.",
        imageUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/7702/media/669f8d4726229_1721732423_La%20boutique%20de%20Gaby%20%288%29.jpg",
        imageFit: "contain"
      },
      {
        name: "Distributeur d’acétone — 200 ml",
        category: "Outils",
        priceLabel: "500 FCFA",
        detail: "Distributeur compact pour poste de manucure.",
        imageUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/7702/media/669f8d4a91384_1721732426_La%20boutique%20de%20Gaby%20%2811%29.jpg",
        imageFit: "contain"
      },
      {
        name: "Lampe UV / LED SUN5 48W",
        category: "Lampes",
        priceLabel: "7 000 FCFA",
        detail: "Lampe UV/LED compacte pour séchage des gels.",
        imageUrl: "https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/7702/media/669f8d4d6f0f6_1721732429_La%20boutique%20de%20Gaby%20%284%29.jpg",
        imageFit: "contain"
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

function MerchantLogo({ merchant }: { merchant: DemoMerchant }) {
  return merchant.logoUrl ? (
    <img className="demo-merchant-logo" src={merchant.logoUrl} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="demo-merchant-monogram">{merchant.initials}</span>
  );
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
      <div className="demo-product-media">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={product.imageFit === "contain" ? "is-contain" : ""}
        />
        <span>{product.category}</span>
      </div>
      <div className="demo-product-copy">
        <h3>{product.name}</h3>
        <p>{product.detail}</p>
        <div className="demo-product-bottom">
          <strong>{product.priceLabel}</strong>
          <a
            href={whatsappHref(merchant, product)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Commander ${product.name} sur WhatsApp`}
          >
            WhatsApp <span aria-hidden="true">↗</span>
          </a>
        </div>
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
        <h1>Aperçu retiré</h1>
        <p>
          Cette démonstration n’est pas prête à être présentée : nous attendons des visuels catalogue vérifiables plutôt que d’inventer des produits.
        </p>
      </main>
    );
  }

  const featured = merchant.products[0];
  const themeStyle = {
    "--demo-ink": merchant.theme.ink,
    "--demo-primary": merchant.theme.primary,
    "--demo-primary-dark": merchant.theme.primaryDark,
    "--demo-soft": merchant.theme.soft,
    "--demo-accent": merchant.theme.accent
  } as CSSProperties;

  return (
    <div className="demo-shell" style={themeStyle}>
      <div className="demo-disclaimer">
        Démonstration privée Commerce Factory — non officielle, créée à partir d’informations publiques.
      </div>

      <header className="demo-header">
        <a className="demo-brand" href={"/demo/" + merchant.slug} aria-label={merchant.name}>
          <MerchantLogo merchant={merchant} />
          <div>
            <strong>{merchant.name}</strong>
            <small>{merchant.location}</small>
          </div>
        </a>
        <div className="demo-header-actions">
          <a className="demo-catalog-link" href={merchant.catalogUrl} target="_blank" rel="noreferrer">
            Catalogue actuel
          </a>
          <a className="demo-primary-button" href={whatsappHref(merchant)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </header>

      <main>
        <section className="demo-hero">
          <div className="demo-hero-copy">
            <span className="demo-overline">{merchant.eyebrow}</span>
            <h1>{merchant.headline}</h1>
            <p>{merchant.description}</p>
            <div className="demo-hero-actions">
              <a className="demo-primary-button demo-primary-button--large" href="#catalogue">
                Voir les produits
              </a>
              <a className="demo-secondary-button" href={merchant.catalogUrl} target="_blank" rel="noreferrer">
                Catalogue WhatsApp ↗
              </a>
            </div>
            <div className="demo-trust-list">
              {merchant.trustPoints.map((point) => <span key={point}>✓ {point}</span>)}
            </div>
          </div>

          <a
            className="demo-featured"
            href={whatsappHref(merchant, featured)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Voir ${featured.name} sur WhatsApp`}
          >
            <img
              src={featured.imageUrl}
              alt={featured.name}
              referrerPolicy="no-referrer"
              className={featured.imageFit === "contain" ? "is-contain" : ""}
            />
            <div className="demo-featured-gradient" />
            <div className="demo-featured-copy">
              <span>{featured.category}</span>
              <strong>{featured.name}</strong>
              <small>{featured.priceLabel}</small>
            </div>
          </a>
        </section>

        <section className="demo-catalogue" id="catalogue">
          <div className="demo-section-heading">
            <div>
              <span className="demo-overline">Sélection</span>
              <h2>Choisissez. Vérifiez. Passez sur WhatsApp.</h2>
            </div>
            <div className="demo-category-pills">
              {categories.map((category) => <span key={category}>{category}</span>)}
            </div>
          </div>

          <div className="demo-product-grid">
            {merchant.products.map((product) => (
              <DemoProductCard key={product.name} merchant={merchant} product={product} />
            ))}
          </div>

          <p className="demo-source-note">{merchant.publicSourceLabel}</p>
        </section>

        <section className="demo-conversion-band">
          <div>
            <span className="demo-overline">Commerce Factory × WhatsApp</span>
            <h2>La vitrine fait le tri. WhatsApp conclut la vente.</h2>
            <p>
              Le client arrive dans la conversation avec le produit déjà identifié, au lieu de recommencer par « bonjour, prix ? ».
            </p>
          </div>
          <a className="demo-primary-button demo-primary-button--large" href={whatsappHref(merchant, featured)} target="_blank" rel="noreferrer">
            Tester avec {featured.name}
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
