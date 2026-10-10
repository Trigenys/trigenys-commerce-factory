import { useEffect, useState } from "react";
import CommerceJourney from "./components/CommerceJourney";

const images = {
  earbuds: {
    avif480: "/landing/earbuds-480.avif",
    avif960: "/landing/earbuds-960.avif",
    webp480: "/landing/earbuds-480.webp",
    webp960: "/landing/earbuds-960.webp",
    width: 512,
    height: 279
  },
  headphones: {
    avif480: "/landing/headphones-480.avif",
    avif960: "/landing/headphones-960.avif",
    webp480: "/landing/headphones-480.webp",
    webp960: "/landing/headphones-960.webp",
    width: 512,
    height: 279
  },
  watch: {
    avif480: "/landing/watch-480.avif",
    avif960: "/landing/watch-960.avif",
    webp480: "/landing/watch-480.webp",
    webp960: "/landing/watch-960.webp",
    width: 512,
    height: 279
  },
  electronics: {
    avif480: "/landing/electronics-480.avif",
    avif960: "/landing/electronics-960.avif",
    webp480: "/landing/electronics-480.webp",
    webp960: "/landing/electronics-960.webp",
    width: 512,
    height: 279
  },
  fashion: {
    avif480: "/landing/fashion-480.avif",
    avif960: "/landing/fashion-960.avif",
    webp480: "/landing/fashion-480.webp",
    webp960: "/landing/fashion-960.webp",
    width: 512,
    height: 286
  },
  beauty: {
    avif480: "/landing/beauty-480.avif",
    avif960: "/landing/beauty-960.avif",
    webp480: "/landing/beauty-480.webp",
    webp960: "/landing/beauty-960.webp",
    width: 512,
    height: 279
  }
} as const;

type LandingImageAsset = (typeof images)[keyof typeof images];

function ResponsiveLandingImage({
  image,
  alt,
  className,
  pictureClassName,
  sizes,
  loading = "lazy"
}: {
  image: LandingImageAsset;
  alt: string;
  className: string;
  pictureClassName: string;
  sizes: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <picture className={pictureClassName}>
      <source
        type="image/avif"
        srcSet={`${image.avif480} 480w, ${image.avif960} ${image.width}w`}
        sizes={sizes}
      />
      <img
        src={image.webp960}
        srcSet={`${image.webp480} 480w, ${image.webp960} ${image.width}w`}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
      />
    </picture>
  );
}

type Language = "en" | "fr";

const stepsByLanguage = {
  en: [
    ["01", "Add your business", "Store name, WhatsApp number, location and FCFA currency settings."],
    ["02", "Add your products", "Upload photos, prices, categories and the variants customers actually need."],
    ["03", "Customize storefront", "Apply your logo, brand color and a clean mobile-first storefront theme."],
    ["04", "Publish & sell", "Share one store link and move high-intent product clicks into WhatsApp."]
  ],
  fr: [
    ["01", "Ajoutez votre entreprise", "Nom de la boutique, numéro WhatsApp, localisation et paramètres de devise FCFA."],
    ["02", "Ajoutez vos produits", "Importez photos, prix, catégories et les variantes dont vos clients ont réellement besoin."],
    ["03", "Personnalisez la boutique", "Appliquez votre logo, vos couleurs et un thème propre pensé d’abord pour le mobile."],
    ["04", "Publiez et vendez", "Partagez un seul lien de boutique et transformez les clics à forte intention en conversations WhatsApp."]
  ]
} as const;

const categoriesByLanguage = {
  en: [
    {
      brand: "TechPulse",
      initials: "TP",
      theme: "tech",
      storeUrl: "commercefactory.shop/techpulse",
      title: "Electronics & gadgets",
      copy: "Specs, price and the product image do the filtering before the WhatsApp chat starts.",
      sample: "Sony WH-1000XM5",
      price: "230,000 FCFA",
      image: images.electronics
    },
    {
      brand: "Maison Noya",
      initials: "MN",
      theme: "fashion",
      storeUrl: "commercefactory.shop/maison-noya",
      title: "Fashion & apparel",
      copy: "A visual storefront for new arrivals, sizes and colors without turning WhatsApp into a product search engine.",
      sample: "Linen two-piece",
      price: "35,000 FCFA",
      image: images.fashion
    },
    {
      brand: "Glow Room",
      initials: "GR",
      theme: "beauty",
      storeUrl: "commercefactory.shop/glow-room",
      title: "Beauty & personal care",
      copy: "Products, routines and prices stay easy to scan before the customer asks for availability in WhatsApp.",
      sample: "Hydration glow kit",
      price: "22,500 FCFA",
      image: images.beauty
    }
  ],
  fr: [
    {
      brand: "TechPulse",
      initials: "TP",
      theme: "tech",
      storeUrl: "commercefactory.shop/techpulse",
      title: "Électronique & gadgets",
      copy: "Les caractéristiques, le prix et le visuel produit font déjà le tri avant le début de la conversation WhatsApp.",
      sample: "Sony WH-1000XM5",
      price: "230 000 FCFA",
      image: images.electronics
    },
    {
      brand: "Maison Noya",
      initials: "MN",
      theme: "fashion",
      storeUrl: "commercefactory.shop/maison-noya",
      title: "Mode & habillement",
      copy: "Une vitrine visuelle pour les nouveautés, tailles et couleurs sans transformer WhatsApp en moteur de recherche produit.",
      sample: "Ensemble deux pièces en lin",
      price: "35 000 FCFA",
      image: images.fashion
    },
    {
      brand: "Glow Room",
      initials: "GR",
      theme: "beauty",
      storeUrl: "commercefactory.shop/glow-room",
      title: "Beauté & soins",
      copy: "Produits, routines et prix restent faciles à parcourir avant que le client demande la disponibilité sur WhatsApp.",
      sample: "Kit éclat hydratant",
      price: "22 500 FCFA",
      image: images.beauty
    }
  ]
} as const;

const metaRoadmapByLanguage = {
  en: [
    ["Catalog sync", "Publish selected Commerce Factory products to a Meta catalog."],
    ["Pixel & CAPI", "Send storefront and high-intent events without making Meta a core dependency."],
    ["Instagram product surfaces", "Prepare product data for eligible Instagram commerce experiences."],
    ["Promote a product", "Later: launch product campaigns from a deliberately simple merchant flow."]
  ],
  fr: [
    ["Synchronisation catalogue", "Publiez les produits Commerce Factory sélectionnés dans un catalogue Meta."],
    ["Pixel & CAPI", "Envoyez les événements de boutique et de forte intention sans rendre Meta indispensable au cœur du produit."],
    ["Surfaces produit Instagram", "Préparez les données produit pour les expériences commerce Instagram éligibles."],
    ["Promouvoir un produit", "Plus tard : lancez des campagnes produit depuis un parcours commerçant volontairement simple."]
  ]
} as const;

const plansByLanguage = {
  en: [
    {
      tier: "starter",
      name: "Starter",
      kicker: "Beta",
      price: "Free",
      description: "Validate your catalog and WhatsApp sales flow.",
      features: ["Up to 25 products", "Commerce Factory store URL", "WhatsApp order handoff", "Basic storefront analytics"],
      cta: "Join beta",
      featured: false
    },
    {
      tier: "pro",
      name: "Pro",
      kicker: "After beta",
      price: "Pricing to validate",
      description: "For merchants who need a stronger branded storefront.",
      features: ["More products & categories", "Custom domain path", "Remove platform branding", "Advanced analytics"],
      cta: "See Pro roadmap",
      featured: true
    },
    {
      tier: "business",
      name: "Business",
      kicker: "Later",
      price: "Talk to us",
      description: "For teams and higher-volume commerce operations.",
      features: ["Team access", "Multiple stores", "Integration controls", "Meta automation roadmap"],
      cta: "Explore Business",
      featured: false
    }
  ],
  fr: [
    {
      tier: "starter",
      name: "Starter",
      kicker: "Bêta",
      price: "Gratuit",
      description: "Validez votre catalogue et votre parcours de vente sur WhatsApp.",
      features: ["Jusqu’à 25 produits", "URL de boutique Commerce Factory", "Passage de commande vers WhatsApp", "Analytique de base de la boutique"],
      cta: "Rejoindre la bêta",
      featured: false
    },
    {
      tier: "pro",
      name: "Pro",
      kicker: "Après la bêta",
      price: "Tarif à valider",
      description: "Pour les commerçants qui veulent une boutique davantage personnalisée à leur marque.",
      features: ["Plus de produits et catégories", "Domaine personnalisé", "Suppression du branding plateforme", "Analytique avancée"],
      cta: "Voir la roadmap Pro",
      featured: true
    },
    {
      tier: "business",
      name: "Business",
      kicker: "Plus tard",
      price: "Parlons-en",
      description: "Pour les équipes et les activités avec un volume plus important.",
      features: ["Accès équipe", "Plusieurs boutiques", "Contrôles d’intégration", "Roadmap d’automatisation Meta"],
      cta: "Découvrir Business",
      featured: false
    }
  ]
} as const;

const copyByLanguage = {
  en: {
    metaTitle: "Commerce Factory by Trigenys",
    metaDescription: "Commerce Factory by Trigenys turns product catalogs into mobile-first storefronts with WhatsApp ordering.",
    navHow: "How it works",
    navShowcase: "Showcase",
    navDashboard: "Dashboard",
    navPricing: "Pricing",
    login: "Log in",
    createStore: "Create my store",
    languageLabel: "Language",
    heroEyebrow: "A storefront made for WhatsApp commerce",
    heroTitleOne: "Your store.",
    heroTitleTwo: "Online in minutes.",
    heroLead: "Turn your catalog into a mobile store. Shoppers pick a product, then open WhatsApp with its details ready.",
    demoStore: "See a demo store",
    principlesLabel: "Product principles",
    noCode: "No code",
    fcfaReady: "FCFA-ready",
    mobileFirst: "Mobile-first",
    whatsappNative: "WhatsApp-native",
    proofTitle: "A real storefront for the way you already sell",
    proofBody: "Customers browse. They choose a product. WhatsApp opens with the context. You close the sale in the flow you already know.",
    storefrontExample: "Example Commerce Factory storefront",
    demoStorefront: "Demo storefront",
    phones: "Phones",
    laptops: "Laptops",
    popular: "Popular",
    newLabel: "New",
    readyWhatsApp: "Ready for WhatsApp",
    buyWhatsApp: "Buy on WhatsApp",
    fastOnboarding: "Fast onboarding",
    howTitle: "From social seller to published store in four clear steps.",
    howBody: "No developer dashboard maze. The setup follows the way a merchant thinks about the business.",
    quickSetup: "Quick setup",
    showcaseOverline: "Storefront examples",
    showcaseTitle: "See what your business could look like before we ever touch your WhatsApp.",
    showcaseBody: "Three fictional storefront concepts show the level of polish Commerce Factory can bring to different merchant categories.",
    demoCategory: "Demo concept",
    demoDisclaimer: "Fictional demo storefronts — not real clients, endorsements or merchant results.",
    whatsappHandoff: "WhatsApp handoff",
    whatsappTitle: "Your customers already use WhatsApp. Sell where they already are.",
    whatsappBody: "Commerce Factory does not pretend a WhatsApp click is a completed sale. The MVP tracks customer intent, preserves product context and hands the conversation to the merchant.",
    flow1Title: "Customer opens a product",
    flow1Body: "Price, product details and variants are clear before the chat starts.",
    flow2Title: "They tap Buy on WhatsApp",
    flow2Body: "The product context is encoded into the message safely.",
    flow3Title: "WhatsApp opens",
    flow3Body: "The merchant receives a useful inquiry instead of “hello, price?”",
    flow4Title: "The merchant closes the sale",
    flow4Body: "Payment and delivery stay in the merchant’s existing process for MVP.",
    whatsappExample: "Example WhatsApp handoff",
    online: "online",
    today: "TODAY",
    productInquiry: "Product inquiry",
    chatInquiry: "Hello 👋 I’d like to order Sony WH-1000XM5 (Black) — 230,000 FCFA.",
    productLabel: "Product",
    chatReply: "Hello! Got it. I’ll confirm availability, payment and delivery with you here.",
    typeMessage: "Type a message…",
    roadmapOverline: "Roadmap • post-MVP",
    roadmapTitle: "Connect the catalog to Meta after the core store earns the right to grow.",
    roadmapBody: "Social commerce is the differentiator, but it should not block the first usable storefront. These integrations are designed as adapters around the core catalog.",
    metaCatalog: "Meta Catalog",
    dashboardOverline: "Merchant dashboard",
    dashboardTitle: "A compact mission control for product interest.",
    dashboardBody: "Demo data below shows the metrics the MVP can genuinely observe.",
    demoAccount: "Demo account",
    overview: "Overview",
    products: "Products",
    whatsappClicks: "WhatsApp clicks",
    socialRoadmap: "Social roadmap",
    demoNote: "Demo data • not live merchant results",
    storeViews: "Store views",
    productViews: "Product views",
    highIntent: "High intent",
    viewToWhatsapp: "View → WhatsApp",
    derivedMetric: "Derived metric",
    topInterest: "Top product interest",
    topInterestBody: "What customers are clicking into WhatsApp for",
    demoData: "Demo data",
    product: "Product",
    views: "Views",
    waClicks: "WA clicks",
    rate: "Rate",
    pricingOverline: "Pricing hypothesis",
    pricingTitle: "Simple plans, without inventing the final numbers before merchants validate them.",
    pricingBody: "Beta pricing will be set from merchant interviews and real usage—not from a landing-page guess.",
    launchOverline: "Private beta direction",
    launchTitle: "Your customers are online. Your store should be too.",
    launchBody: "The next milestone is one real merchant creating a store, publishing products and receiving a useful WhatsApp inquiry without developer help.",
    launchCta: "See how the beta works",
    launchNote: "No fake checkout • No fake revenue claims • Built by Trigenys",
    footerBody: "Lightweight storefront infrastructure for WhatsApp-first commerce.",
    footerStatus: "Commerce Factory is currently an MVP in development."
  },
  fr: {
    metaTitle: "Commerce Factory par Trigenys",
    metaDescription: "Commerce Factory par Trigenys transforme les catalogues produits en boutiques mobile-first avec commande via WhatsApp.",
    navHow: "Comment ça marche",
    navShowcase: "Exemples",
    navDashboard: "Tableau de bord",
    navPricing: "Tarifs",
    login: "Connexion",
    createStore: "Créer ma boutique",
    languageLabel: "Langue",
    heroEyebrow: "Le commerce pensé pour WhatsApp",
    heroTitleOne: "Votre boutique.",
    heroTitleTwo: "En ligne en quelques minutes.",
    heroLead: "Transformez vos produits en boutique mobile. Vos clients choisissent un article, puis ouvrent WhatsApp avec les détails déjà prêts.",
    demoStore: "Voir une boutique démo",
    principlesLabel: "Principes du produit",
    noCode: "Sans code",
    fcfaReady: "Prêt pour le FCFA",
    mobileFirst: "Pensé mobile",
    whatsappNative: "Natif WhatsApp",
    proofTitle: "Une vraie boutique pour vendre comme vous vendez déjà",
    proofBody: "Le client parcourt, choisit un produit, puis WhatsApp s’ouvre avec le contexte. Vous concluez la vente dans votre parcours habituel.",
    storefrontExample: "Exemple de boutique Commerce Factory",
    demoStorefront: "Boutique démo",
    phones: "Téléphones",
    laptops: "Ordinateurs",
    popular: "Populaire",
    newLabel: "Nouveau",
    readyWhatsApp: "Prêt pour WhatsApp",
    buyWhatsApp: "Acheter sur WhatsApp",
    fastOnboarding: "Mise en route rapide",
    howTitle: "De vendeur sur les réseaux à boutique publiée en quatre étapes claires.",
    howBody: "Pas de labyrinthe de tableaux de bord techniques. La configuration suit simplement la façon dont un commerçant pense son activité.",
    quickSetup: "Configuration rapide",
    showcaseOverline: "Exemples de boutiques",
    showcaseTitle: "Voyez à quoi votre activité pourrait ressembler avant même de toucher à votre WhatsApp.",
    showcaseBody: "Trois concepts de boutiques fictives montrent le niveau de finition que Commerce Factory peut apporter à différents types de commerces.",
    demoCategory: "Concept démo",
    demoDisclaimer: "Boutiques fictives de démonstration — pas de vrais clients, partenariats ou résultats commerçants.",
    whatsappHandoff: "Passage vers WhatsApp",
    whatsappTitle: "Vos clients utilisent déjà WhatsApp. Vendez là où ils sont déjà.",
    whatsappBody: "Commerce Factory ne prétend pas qu’un clic WhatsApp est une vente conclue. Le MVP mesure l’intention, conserve le contexte du produit et transmet la conversation au commerçant.",
    flow1Title: "Le client ouvre un produit",
    flow1Body: "Le prix, les détails et les variantes sont clairs avant le début de la discussion.",
    flow2Title: "Il appuie sur Acheter sur WhatsApp",
    flow2Body: "Le contexte du produit est intégré proprement au message.",
    flow3Title: "WhatsApp s’ouvre",
    flow3Body: "Le commerçant reçoit une demande utile au lieu d’un simple « bonjour, prix ? ».",
    flow4Title: "Le commerçant conclut la vente",
    flow4Body: "Le paiement et la livraison restent dans son processus habituel pour le MVP.",
    whatsappExample: "Exemple de passage vers WhatsApp",
    online: "en ligne",
    today: "AUJOURD’HUI",
    productInquiry: "Demande produit",
    chatInquiry: "Bonjour 👋 Je souhaite commander le Sony WH-1000XM5 (Noir) — 230 000 FCFA.",
    productLabel: "Produit",
    chatReply: "Bonjour ! Bien reçu. Je vous confirme ici la disponibilité, le paiement et la livraison.",
    typeMessage: "Écrire un message…",
    roadmapOverline: "Feuille de route • après MVP",
    roadmapTitle: "Connectez le catalogue à Meta une fois que la boutique principale a prouvé sa valeur.",
    roadmapBody: "Le social commerce est le différenciateur, mais il ne doit pas bloquer la première boutique utilisable. Ces intégrations sont conçues comme des adaptateurs autour du catalogue central.",
    metaCatalog: "Catalogue Meta",
    dashboardOverline: "Tableau de bord commerçant",
    dashboardTitle: "Un poste de pilotage compact pour suivre l’intérêt produit.",
    dashboardBody: "Les données de démonstration ci-dessous montrent les métriques que le MVP peut réellement observer.",
    demoAccount: "Compte démo",
    overview: "Vue d’ensemble",
    products: "Produits",
    whatsappClicks: "Clics WhatsApp",
    socialRoadmap: "Roadmap sociale",
    demoNote: "Données démo • pas de résultats réels de commerçants",
    storeViews: "Vues boutique",
    productViews: "Vues produit",
    highIntent: "Forte intention",
    viewToWhatsapp: "Vue → WhatsApp",
    derivedMetric: "Métrique calculée",
    topInterest: "Produits suscitant le plus d’intérêt",
    topInterestBody: "Ce que les clients ouvrent dans WhatsApp",
    demoData: "Données démo",
    product: "Produit",
    views: "Vues",
    waClicks: "Clics WA",
    rate: "Taux",
    pricingOverline: "Hypothèse tarifaire",
    pricingTitle: "Des offres simples, sans inventer les prix définitifs avant validation par les commerçants.",
    pricingBody: "Les tarifs de la bêta seront fixés à partir d’entretiens commerçants et de l’usage réel — pas d’une estimation de landing page.",
    launchOverline: "Objectif bêta privée",
    launchTitle: "Vos clients sont en ligne. Votre boutique devrait l’être aussi.",
    launchBody: "La prochaine étape est qu’un vrai commerçant crée sa boutique, publie ses produits et reçoive une demande WhatsApp utile sans aide d’un développeur.",
    launchCta: "Voir comment fonctionne la bêta",
    launchNote: "Pas de faux checkout • Pas de faux chiffres de revenus • Conçu par Trigenys",
    footerBody: "Une infrastructure de boutique légère pour le commerce centré sur WhatsApp.",
    footerStatus: "Commerce Factory est actuellement un MVP en développement."
  }
} as const;

function ProductCard({
  image,
  name,
  price,
  badge,
  buyLabel
}: {
  image: LandingImageAsset;
  name: string;
  price: string;
  badge?: string;
  buyLabel: string;
}) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <ResponsiveLandingImage
          image={image}
          alt=""
          className="product-image"
          pictureClassName="product-image-picture"
          sizes="(max-width: 420px) 45vw, (max-width: 780px) 42vw, 240px"
          loading="eager"
        />
        {badge ? <span className="product-badge">{badge}</span> : null}
      </div>
      <div className="product-copy">
        <p>{name}</p>
        <strong>{price}</strong>
      </div>
      <span className="whatsapp-button" aria-hidden="true">
        <span className="wa-dot">WA</span>
        {buyLabel}
      </span>
    </article>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem("commerce-factory-language");
    if (saved === "en" || saved === "fr") return saved;
    // Cameroon-first landing: French is the default; an explicit EN selection is preserved.
    return "fr";
  });

  const t = copyByLanguage[language];
  const steps = stepsByLanguage[language];
  const categories = categoriesByLanguage[language];
  const metaRoadmap = metaRoadmapByLanguage[language];
  const plans = plansByLanguage[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.metaTitle;
    window.localStorage.setItem("commerce-factory-language", language);
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.metaDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", t.metaTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", t.metaDescription);
  }, [language, t]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#top">
        {language === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={language === "fr" ? "Accueil Commerce Factory" : "Commerce Factory home"}>
          <img
            className="brand-logo"
            src="/commerce-factory-logo-v3.png?v=3"
            alt="Commerce Factory by Trigenys"
          />
        </a>

        <nav className="desktop-nav" aria-label={language === "fr" ? "Navigation principale" : "Primary navigation"}>
          <a href="#how">{t.navHow}</a>
          <a href="#showcase">{t.navShowcase}</a>
          <a href="#whatsapp">WhatsApp</a>
          <a href="#dashboard">{t.navDashboard}</a>
          <a href="#pricing">{t.navPricing}</a>
        </nav>

        <div className="header-actions">
          <a className="header-login" href="/app">{t.login}</a>
          <div className="language-switch" role="group" aria-label={t.languageLabel}>
            <button
              type="button"
              className={language === "fr" ? "active" : ""}
              onClick={() => setLanguage("fr")}
              aria-pressed={language === "fr"}
            >
              FR
            </button>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
            >
              EN
            </button>
          </div>
          <a className="button button-primary button-compact" href="/app">
            {t.createStore}
          </a>
        </div>
      </header>

      <main id="top" tabIndex={-1}>
        <section className="hero-section section">
          <div className="hero-aura hero-aura-one" />
          <div className="hero-aura hero-aura-two" />

          <div className="hero-copy">
            <span className="eyebrow"><i /> {t.heroEyebrow}</span>
            <h1>
              {t.heroTitleOne}
              <span>{t.heroTitleTwo}</span>
            </h1>
            <p className="hero-lede">{t.heroLead}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="/app">{t.createStore} <span>→</span></a>
              <a className="button button-soft" href="#showcase">{t.demoStore}</a>
            </div>
            <div className="trust-row" aria-label={t.principlesLabel}>
              <span>✓ {t.noCode}</span>
              <span>✓ {t.fcfaReady}</span>
              <span>✓ {t.mobileFirst}</span>
              <span>✓ {t.whatsappNative}</span>
            </div>
            <div className="proof-card">
              <span className="proof-icon">✓</span>
              <div>
                <strong>{t.proofTitle}</strong>
                <p>{t.proofBody}</p>
              </div>
            </div>
          </div>

          <div className="hero-visual" role="group" aria-label={t.storefrontExample}>
            <span className="visual-kicker">
              {language === "fr" ? "Boutique démo • WhatsApp-first" : "Demo storefront • WhatsApp-first"}
            </span>
            <div className="browser-card">
              <div className="browser-bar">
                <span className="browser-dots"><i /><i /><i /></span>
                <span className="address-pill">commercefactory.shop/techpulse</span>
                <span>↗</span>
              </div>
              <div className="store-preview">
                <div className="store-preview-header">
                  <div className="merchant-name">
                    <span className="merchant-avatar">TP</span>
                    <span><strong>TechPulse</strong><small>Douala • {t.demoStorefront}</small></span>
                  </div>
                  <span className="currency-pill">XAF</span>
                </div>
                <div className="category-pills">
                  <span className="active">Audio</span><span>{t.phones}</span><span>{t.laptops}</span>
                </div>
                <div className="product-grid">
                  <ProductCard image={images.earbuds} name="Wireless Earbuds Pro" price={language === "fr" ? "145 000 FCFA" : "145,000 FCFA"} badge={t.popular} buyLabel={t.buyWhatsApp} />
                  <ProductCard image={images.headphones} name="Sony WH-1000XM5" price={language === "fr" ? "230 000 FCFA" : "230,000 FCFA"} badge={t.newLabel} buyLabel={t.buyWhatsApp} />
                </div>
              </div>
            </div>

            <div className="phone-card">
              <div className="phone-notch" />
              <span className="phone-store-name">TechPulse Mobile</span>
              <ResponsiveLandingImage
                image={images.watch}
                alt=""
                className="phone-product-image"
                pictureClassName="phone-product-picture"
                sizes="180px"
                loading="eager"
              />
              <span className="phone-product-name">Smart Watch Ultra</span>
              <strong>65,000 FCFA</strong>
              <span className="phone-status">{t.readyWhatsApp}</span>
              <span className="whatsapp-button phone-button" aria-hidden="true">
                <span className="wa-dot">WA</span> {t.buyWhatsApp}
              </span>
            </div>
          </div>
        </section>

        <section className="section section-tint" id="how">
          <div className="section-heading centered">
            <span className="overline">{t.fastOnboarding}</span>
            <h2>{t.howTitle}</h2>
            <p>{t.howBody}</p>
          </div>
          <div className="steps-grid">
            {steps.map(([number, title, copy]) => (
              <article className="step-card" key={number}>
                <div className="step-top"><strong>{number}</strong><span>{t.quickSetup}</span></div>
                <div className="step-icon">{number === "04" ? "↗" : "•"}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="showcase">
          <div className="section-heading">
            <span className="overline">{t.showcaseOverline}</span>
            <h2>{t.showcaseTitle}</h2>
            <p>{t.showcaseBody}</p>
          </div>

          <div className="merchant-showcase-grid">
            {categories.map((item) => (
              <article className={`merchant-showcase-card merchant-showcase-card--${item.theme}`} key={item.brand}>
                <div className="merchant-showcase-browser">
                  <div className="merchant-showcase-bar">
                    <span className="merchant-showcase-dots"><i /><i /><i /></span>
                    <span>{item.storeUrl}</span>
                    <b>↗</b>
                  </div>

                  <div className="merchant-showcase-store">
                    <div className="merchant-showcase-brand">
                      <span>{item.initials}</span>
                      <div>
                        <strong>{item.brand}</strong>
                        <small>{t.demoCategory}</small>
                      </div>
                    </div>

                    <div className="merchant-showcase-media">
                      <ResponsiveLandingImage
                        image={item.image}
                        alt=""
                        className="merchant-showcase-image"
                        pictureClassName="merchant-showcase-picture"
                        sizes="(max-width: 760px) 92vw, 31vw"
                      />
                      <span className="merchant-showcase-category">{item.title}</span>
                    </div>

                    <div className="merchant-showcase-product">
                      <div>
                        <strong>{item.sample}</strong>
                        <span>{item.price}</span>
                      </div>
                      <span className="merchant-showcase-whatsapp">
                        <span className="wa-dot">WA</span>
                        {t.buyWhatsApp}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="merchant-showcase-copy">
                  <span className="mini-tag">{t.demoCategory}</span>
                  <h3>{item.brand}</h3>
                  <p>{item.copy}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="showcase-disclaimer">{t.demoDisclaimer}</p>
        </section>

        <CommerceJourney language={language} />

        <section className="section" id="social">
          <div className="roadmap-card">
            <div className="section-heading">
              <span className="overline purple">{t.roadmapOverline}</span>
              <h2>{t.roadmapTitle}</h2>
              <p>{t.roadmapBody}</p>
            </div>
            <div className="sync-line" aria-hidden="true">
              <span>Commerce Factory</span><b>→</b><span>{t.metaCatalog}</span><b>→</b><span>Instagram / Facebook</span>
            </div>
            <div className="roadmap-grid">
              {metaRoadmap.map(([title, copy]) => (
                <article key={title}>
                  <span className="roadmap-icon">↗</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-tint" id="dashboard">
          <div className="section-heading centered">
            <span className="overline">{t.dashboardOverline}</span>
            <h2>{t.dashboardTitle}</h2>
            <p>{t.dashboardBody}</p>
          </div>
          <div className="dashboard-shell">
            <aside className="dashboard-sidebar">
              <div className="dashboard-brand"><span>CF</span><div><strong>Aura Store</strong><small>{t.demoAccount}</small></div></div>
              <nav>
                <a className="active" href="#dashboard">{t.overview}</a>
                <a href="#showcase">{t.products}</a>
                <a href="#whatsapp">{t.whatsappClicks}</a>
                <a href="#social">{t.socialRoadmap}</a>
              </nav>
              <small className="demo-note">{t.demoNote}</small>
            </aside>
            <div className="dashboard-main">
              <div className="metrics-grid">
                <div><small>{t.storeViews}</small><strong>18,420</strong><span>Demo</span></div>
                <div><small>{t.productViews}</small><strong>41,290</strong><span>Demo</span></div>
                <div><small>{t.whatsappClicks}</small><strong>1,842</strong><span>{t.highIntent}</span></div>
                <div><small>{t.viewToWhatsapp}</small><strong>10.0%</strong><span>{t.derivedMetric}</span></div>
              </div>
              <div className="insight-table">
                <div className="table-head">
                  <span><strong>{t.topInterest}</strong><small>{t.topInterestBody}</small></span>
                  <span className="demo-pill">{t.demoData}</span>
                </div>
                <div className="table-row table-labels"><span>{t.product}</span><span>{t.views}</span><span>{t.waClicks}</span><span>{t.rate}</span></div>
                <div className="table-row"><span>Sony WH-1000XM5</span><span>2,840</span><span>312</span><strong>11.0%</strong></div>
                <div className="table-row"><span>Wireless Earbuds Pro</span><span>2,110</span><span>221</span><strong>10.5%</strong></div>
                <div className="table-row"><span>Smart Watch Ultra</span><span>1,760</span><span>162</span><strong>9.2%</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="section-heading centered">
            <span className="overline">{t.pricingOverline}</span>
            <h2>{t.pricingTitle}</h2>
            <p>{t.pricingBody}</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={plan.featured ? "price-card featured" : "price-card"} key={plan.name}>
                <span className="price-kicker">{plan.kicker}</span>
                <h3>{plan.name}</h3>
                <strong className="price-value">{plan.price}</strong>
                <p>{plan.description}</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
                </ul>
                <a href={plan.tier === "starter" ? "/app" : "#social"} className={plan.featured ? "button button-primary" : "button button-soft"}>
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="launch">
          <div className="launch-card">
            <span className="launch-icon">↗</span>
            <span className="overline inverse">{t.launchOverline}</span>
            <h2>{t.launchTitle}</h2>
            <p>{t.launchBody}</p>
            <a className="button button-primary launch-button" href="/app">{t.launchCta}</a>
            <small>{t.launchNote}</small>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <a className="brand footer-brand" href="#top" aria-label={language === "fr" ? "Accueil Commerce Factory" : "Commerce Factory home"}>
            <img
              className="brand-logo"
              src="/commerce-factory-logo-v3.png?v=3"
              alt="Commerce Factory by Trigenys"
            />
          </a>
          <p>{t.footerBody}</p>
        </div>
        <div className="footer-links">
          <a href="#how">{t.navHow}</a>
          <a href="#showcase">{t.navShowcase}</a>
          <a href="#dashboard">{t.navDashboard}</a>
          <a href="#pricing">{t.navPricing}</a>
        </div>
        <small>{t.footerStatus}</small>
      </footer>
    </div>
  );
}
