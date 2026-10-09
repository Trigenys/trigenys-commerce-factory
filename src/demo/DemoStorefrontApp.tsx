import { useEffect, useMemo, useState } from "react";
import "./demo-storefront.css";

type DemoTheme = "tech" | "beauty" | "kids";

type DemoProduct = {
  name: string;
  category: string;
  priceLabel: string;
  detail: string;
  imageUrl: string;
  imageAlt: string;
};

type DemoMerchant = {
  slug: string;
  theme: DemoTheme;
  name: string;
  initials: string;
  location: string;
  heroTitle: string;
  heroSubtitle: string;
  whatsappNumber: string;
  catalogUrl: string;
  publicSourceLabel: string;
  trustPoints: string[];
  products: DemoProduct[];
};

const merchants: Record<string, DemoMerchant> = {
  "faya-computer": {
    slug: "faya-computer",
    theme: "tech",
    name: "Faya Computer Technologic",
    initials: "FC",
    location: "Yaoundé • Mfoundi Mall · Douala • Bonamoussadi",
    heroTitle: "Le bon PC. Le bon budget. Sans perdre le client dans WhatsApp.",
    heroSubtitle:
      "Une vitrine claire pour parcourir les workstations, laptops étudiants et machines business avant de passer à la conversation.",
    whatsappNumber: "237699176612",
    catalogUrl: "https://wa.me/c/237699176612",
    publicSourceLabel:
      "Produits, gammes et prix issus d'offres publiques Faya Computer observées en 2026",
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
        imageUrl:
          "https://mediazone.ma/product/images/16672-tUk0EF4F/lenovo-thinkpad-p1-gen-6-i7-13eme-64go-1to-ssd-rtx-2000-ada-16-wuxga-maroc.webp",
        imageAlt: "Lenovo ThinkPad P1 Gen 6"
      },
      {
        name: "Dell Precision 7560",
        category: "Ingénierie",
        priceLabel: "699 900 FCFA",
        detail: "Station mobile • RTX pro • pensée pour CAO, rendu et ingénierie",
        imageUrl:
          "https://laptop365.vn/pic/product/images/laptop-precision-7560-pdp-mod-laptop365%20%283%29%281%29.jpeg",
        imageAlt: "Dell Precision 7560"
      },
      {
        name: "HP ZBook Fury 17 G8",
        category: "Haute performance",
        priceLabel: "Prix sur WhatsApp",
        detail: "Xeon • RTX A5000 • workstation 17 pouces pour charges lourdes",
        imageUrl:
          "https://files.refurbed.com/ii/hp-zbook-fury-17-g8-11850h-17-3-1678280335.jpg",
        imageAlt: "HP ZBook Fury 17 G8"
      },
      {
        name: "MacBook Pro 16”",
        category: "Apple",
        priceLabel: "Voir le catalogue",
        detail: "Création, vidéo, musique et développement dans l'écosystème Apple",
        imageUrl: "https://unilap.vn/storage/unilap/40-1.png",
        imageAlt: "MacBook Pro 16 pouces"
      },
      {
        name: "HP EliteBook",
        category: "Business",
        priceLabel: "Voir le catalogue",
        detail: "PC professionnel compact pour cadres, mobilité et bureautique",
        imageUrl:
          "https://www.gadgetsalvation.com/media/iopt/catalog/product/cache/34e3fbe42bbd758997d9376083641673/h/p/hp_elitebook_840_g6_series_1_1.webp",
        imageAlt: "HP EliteBook"
      },
      {
        name: "Laptops étudiants",
        category: "Études",
        priceLabel: "Dès 89 900 FCFA",
        detail: "Des machines pour cours, recherches, projets et présentations",
        imageUrl:
          "https://www.camerbiz.com/product-images/1798/_img_1_640x480.jpg",
        imageAlt: "Ordinateur portable pour étudiant"
      }
    ]
  },
  "la-boutique-de-gaby": {
    slug: "la-boutique-de-gaby",
    theme: "beauty",
    name: "La Boutique de Gaby",
    initials: "GB",
    location: "Yaoundé • Mfoundi Mall · Douala • Beedi",
    heroTitle: "Le nail art mérite mieux qu'une liste perdue dans les statuts.",
    heroSubtitle:
      "Airbrush, gels, make-up et accessoires organisés comme une vraie boutique, avec WhatsApp toujours à un clic.",
    whatsappNumber: "237687054262",
    catalogUrl: "https://wa.me/c/237687054262",
    publicSourceLabel:
      "Catégories et produits cités dans des publications publiques de La Boutique de Gaby",
    trustPoints: [
      "Catalogue WhatsApp actif",
      "Points de vente Yaoundé & Douala",
      "Tutoriels et conseils produits réguliers"
    ],
    products: [
      {
        name: "Airbrush Nail Art",
        category: "Nail art",
        priceLabel: "Prix sur WhatsApp",
        detail: "Dégradés, motifs précis et créations détaillées",
        imageUrl:
          "https://savilandofficial.com/cdn/shop/files/Airbrush-for-Nails-SA0826-01.jpg?v=1735112858",
        imageAlt: "Kit airbrush pour nail art"
      },
      {
        name: "Blooming Gel",
        category: "Nail art",
        priceLabel: "Prix sur WhatsApp",
        detail: "Base gel pour effets fluides, marbrés et artistiques",
        imageUrl:
          "https://nailmartusa.com/cdn/shop/files/bloominggel8ml_800x800_dcdc3e9d-92af-42b1-b34d-95985f7950de_2048x.jpg?v=1775594150",
        imageAlt: "Blooming gel pour nail art"
      },
      {
        name: "Gel 3D",
        category: "Nail art",
        priceLabel: "Prix sur WhatsApp",
        detail: "Pour décorations en relief et détails sculptés",
        imageUrl:
          "https://www.seol-cosmetics.pl/public/upload/sellasist_cache/original_6bf865610cf6867c90eaef4e7ed9f450.png",
        imageAlt: "Gel 3D pour nail art"
      },
      {
        name: "Beauty blenders & éponges",
        category: "Make-up",
        priceLabel: "Prix sur WhatsApp",
        detail: "Éponges de finition pour teint et application maquillage",
        imageUrl:
          "https://i5.walmartimages.com/seo/FACEMADE-6-Pcs-Makeup-Sponges-Set-Makeup-Sponges-for-Foundation-Latex-Free-Beauty-Sponges-Multiple-Colors_c6783fa5-10df-4f5e-b015-ac4e15d892a5.4e970e6f95345015ebee485393d6b059.jpeg",
        imageAlt: "Éponges de maquillage colorées"
      },
      {
        name: "Hair wax & baby hair",
        category: "Cheveux",
        priceLabel: "Prix sur WhatsApp",
        detail: "Wax et accessoires pour finition et plaquage baby hair",
        imageUrl:
          "https://amylacosmetics.com/cdn/shop/files/USP_edge_control_photo_produit.png?v=1746437104&width=800",
        imageAlt: "Edge control pour baby hair"
      },
      {
        name: "Gel Nail Art couleurs",
        category: "Couleurs",
        priceLabel: "Prix sur WhatsApp",
        detail: "Palette de couleurs pour lignes, motifs et détails",
        imageUrl:
          "https://th-test-11.slatic.net/p/d7cee4af33a75daadaaeeafdca6c7968.jpg",
        imageAlt: "Set de gels colorés pour nail art"
      }
    ]
  },
  "love-shop": {
    slug: "love-shop",
    theme: "kids",
    name: "LOVE SHOP",
    initials: "LS",
    location: "Yaoundé • Awae Escalier",
    heroTitle: "Les pépites enfants, faciles à voir. Faciles à commander.",
    heroSubtitle:
      "Rentrée, vêtements, chaussures et accessoires réunis dans une vitrine visuelle qui envoie ensuite le bon produit dans WhatsApp.",
    whatsappNumber: "237656595525",
    catalogUrl: "https://wa.me/c/237656595525",
    publicSourceLabel:
      "Catégories issues d'offres publiques LOVE SHOP et de son catalogue WhatsApp",
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
        detail: "Des sacs pratiques et colorés pour la rentrée",
        imageUrl: "https://images.nexusapp.co/assets/cb/7f/ce/327196487.jpg",
        imageAlt: "Sac à dos scolaire enfant"
      },
      {
        name: "Gourdes enfants",
        category: "Rentrée",
        priceLabel: "Prix dans le catalogue",
        detail: "Gourdes colorées faciles à emporter à l'école",
        imageUrl:
          "https://www.toynix.pk/cdn/shop/files/grok-image-d869b89d-e607-4146-bc94-216f10dbcd86.jpg?v=1772695845",
        imageAlt: "Gourdes colorées pour enfants"
      },
      {
        name: "Gamelles & sacs gamelles",
        category: "Rentrée",
        priceLabel: "Prix dans le catalogue",
        detail: "Repas et goûters organisés pour la journée d'école",
        imageUrl:
          "https://homenkitchenshop.com/cdn/shop/files/71LEQHWnfEL.jpg?v=1758797958&width=1200",
        imageAlt: "Lunch box enfant"
      },
      {
        name: "Montres enfants waterproof",
        category: "Accessoires",
        priceLabel: "Prix dans le catalogue",
        detail: "Montres sport et accessoires pensés pour les enfants",
        imageUrl:
          "https://i.ebayimg.com/images/g/jSoAAOSwsTxm4CTa/s-l1200.jpg",
        imageAlt: "Montre digitale waterproof pour enfant"
      },
      {
        name: "Tenues enfants",
        category: "Mode",
        priceLabel: "Voir le catalogue",
        detail: "Looks confortables pour filles et garçons",
        imageUrl:
          "https://kuchikookids.com/cdn/shop/files/WhatsAppImage2026-04-04at4.09.56PM_6.jpg?v=1775300939&width=1100",
        imageAlt: "Tenues coordonnées pour enfants"
      },
      {
        name: "Chaussures enfants",
        category: "Chaussures",
        priceLabel: "Voir le catalogue",
        detail: "Sneakers et modèles faciles à porter au quotidien",
        imageUrl:
          "https://addisoutfits.com/cdn/shop/files/O1CN019h5sDS1bM9NVK631R__2215432683450-0-cib.jpg?v=1742980161&width=1445",
        imageAlt: "Sneakers blanches pour enfants"
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

function DemoImage({
  product,
  priority = false,
  className = ""
}: {
  product: DemoProduct;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={"demo-image-shell " + className}>
      {!failed ? (
        <img
          src={product.imageUrl}
          alt={product.imageAlt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="demo-image-fallback" aria-label={product.imageAlt}>
          <span>{product.category}</span>
          <strong>{product.name}</strong>
        </div>
      )}
    </div>
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
      <DemoImage product={product} />
      <div className="demo-product-copy">
        <span className="demo-product-category">{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.detail}</p>
        <div className="demo-product-bottom">
          <strong>{product.priceLabel}</strong>
          <a
            href={whatsappHref(merchant, product)}
            target="_blank"
            rel="noreferrer"
            className="demo-whatsapp-button"
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
        <h1>Aperçu indisponible</h1>
        <p>Cette démonstration privée n’existe pas ou n’est plus active.</p>
      </main>
    );
  }

  const [featured, second, third] = merchant.products;

  return (
    <div className={`demo-shell demo-theme-${merchant.theme}`}>
      <div className="demo-disclaimer">
        <strong>Démo privée non officielle</strong>
        <span>•</span>
        <span>préparée pour {merchant.name} à partir d’informations publiques</span>
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
            Catalogue
          </a>
          <a className="demo-primary-button" href={whatsappHref(merchant)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </header>

      <main>
        <section className="demo-hero">
          <div className="demo-hero-copy">
            <span className="demo-overline">{merchant.name} × COMMERCE FACTORY</span>
            <h1>{merchant.heroTitle}</h1>
            <p>{merchant.heroSubtitle}</p>
            <div className="demo-hero-actions">
              <a className="demo-primary-button demo-primary-button--large" href="#catalogue">
                Voir la boutique
              </a>
              <a className="demo-secondary-button" href={merchant.catalogUrl} target="_blank" rel="noreferrer">
                Catalogue WhatsApp ↗
              </a>
            </div>
            <div className="demo-trust-list" aria-label="Informations publiques">
              {merchant.trustPoints.map((point) => <span key={point}>✓ {point}</span>)}
            </div>
          </div>

          <div className="demo-hero-showcase" aria-label="Aperçu visuel du catalogue">
            {featured ? (
              <article className="demo-feature-card">
                <DemoImage product={featured} priority className="demo-feature-image" />
                <div>
                  <span>{featured.category}</span>
                  <strong>{featured.name}</strong>
                  <small>{featured.priceLabel}</small>
                </div>
              </article>
            ) : null}
            <div className="demo-mini-stack">
              {[second, third].filter(Boolean).map((product) => (
                <article key={product.name} className="demo-mini-card">
                  <DemoImage product={product} className="demo-mini-image" />
                  <div>
                    <span>{product.category}</span>
                    <strong>{product.name}</strong>
                  </div>
                </article>
              ))}
            </div>
            <div className="demo-chat-preview">
              <span className="demo-chat-icon">WA</span>
              <div>
                <strong>Commande prête à continuer</strong>
                <p>{featured ? `${featured.name} • ${featured.priceLabel}` : "Produit sélectionné"}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </div>
          </div>
        </section>

        <section className="demo-catalogue" id="catalogue">
          <div className="demo-section-heading">
            <div>
              <span className="demo-overline">CATALOGUE</span>
              <h2>On voit le produit avant d’ouvrir WhatsApp.</h2>
              <p>
                Moins de « bonjour prix ? », plus de contexte dès le premier message.
              </p>
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

          <p className="demo-source-note">
            {merchant.publicSourceLabel}. Les visuels servent à illustrer les références/catégories correspondantes lorsque la photo officielle du marchand n’est pas réutilisée. Aucun prix manquant n’est inventé.
          </p>
        </section>

        <section className="demo-conversion-band">
          <div>
            <span className="demo-overline">PARCOURS CLIENT</span>
            <h2>La vitrine fait le tri. WhatsApp fait la conversation.</h2>
            <p>
              Le client arrive avec un produit identifié, son prix lorsqu’il est public et une intention plus claire.
            </p>
          </div>
          <a
            className="demo-whatsapp-cta"
            href={featured ? whatsappHref(merchant, featured) : whatsappHref(merchant)}
            target="_blank"
            rel="noreferrer"
          >
            Tester avec {featured?.name || "un produit"} <span aria-hidden="true">↗</span>
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
