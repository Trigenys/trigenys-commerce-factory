export type ThemeLanguage = "fr" | "en";
export type ThemeLayout = "spotlight" | "editorial" | "panels" | "lookbook" | "catalog" | "menu";
export type ThemeFont = "sans" | "serif" | "display";
export type ThemeSettings = {
  accent?: string;
  font?: ThemeFont;
  imageFit?: "contain" | "cover";
};

export const themeSectors = {
  general: { fr: "Tous commerces", en: "General retail" },
  fashion: { fr: "Mode & vêtements", en: "Fashion & clothing" },
  beauty: { fr: "Beauté & soins", en: "Beauty & haircare" },
  tech: { fr: "Électronique & informatique", en: "Electronics & computers" },
  sport: { fr: "Sport & maillots", en: "Sports & jerseys" },
  jewelry: { fr: "Bijoux & montres", en: "Jewelry & watches" },
  accessories: { fr: "Chaussures & sacs", en: "Shoes & bags" },
  home: { fr: "Maison & décoration", en: "Home & interiors" },
  grocery: { fr: "Épicerie & artisanat", en: "Groceries & artisan food" },
  food: { fr: "Restaurants & pâtisserie", en: "Restaurants & pastry" },
  kids: { fr: "Bébé & enfants", en: "Baby & kids" },
  auto: { fr: "Accessoires auto & pièces", en: "Auto accessories & parts" },
  gifts: { fr: "Cadeaux & créations", en: "Gifts & handmade" }
} as const;

export type ThemeSector = keyof typeof themeSectors;
type ThemeTokens = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  scene: string;
  sceneInk: string;
  sceneMuted: string;
};

const palettes = {
  clean: ["#f8faf9", "#ffffff", "#17211d", "#56645e", "#006948", "#eef4f0", "#17211d", "#56645e"],
  paper: ["#f4f0e9", "#fffdf8", "#23221f", "#615c55", "#7c3e2f", "#e7dfd1", "#23221f", "#615c55"],
  clay: ["#f5eee9", "#fffaf6", "#372a25", "#706056", "#93452b", "#af5a3c", "#fffaf6", "#fffdf8"],
  gold: ["#f3efe7", "#fffcf7", "#282218", "#6b6256", "#bd922f", "#292318", "#fffbef", "#d0c3a5"],
  botanical: ["#edf0e6", "#fbfcf4", "#253b2c", "#50664f", "#57704b", "#d2ddc1", "#253b2c", "#486043"],
  electric: ["#edf1f7", "#ffffff", "#12253c", "#50637b", "#2464db", "#112840", "#f4f8ff", "#b3c7e2"],
  chrome: ["#e9eaed", "#f9fafc", "#20242e", "#5c626f", "#343dfa", "#c8ccd4", "#20242e", "#4a505e"],
  stadium: ["#edf2e5", "#fbfff5", "#143c2b", "#50634d", "#e6c944", "#146c45", "#ffffff", "#d7ecd8"],
  club: ["#eff0f7", "#ffffff", "#161d40", "#576080", "#de5130", "#172757", "#ffffff", "#c2c9e2"],
  plum: ["#f4ecf1", "#fffafd", "#382332", "#705e6a", "#8e4269", "#522b42", "#fffafd", "#e3cbd8"],
  ink: ["#eeece8", "#ffffff", "#171717", "#5c5955", "#dbff56", "#191b17", "#ffffff", "#c6c9bb"],
  blue: ["#eef1f4", "#ffffff", "#263e52", "#5a6c7c", "#295d79", "#d4e2e8", "#263e52", "#4c6275"],
  market: ["#f1f3e8", "#ffffff", "#30452e", "#5c6b50", "#42682e", "#dde5c4", "#30452e", "#526548"],
  tangerine: ["#fff2e6", "#fffdf8", "#482819", "#805d49", "#be4b16", "#f5ae64", "#482819", "#69442d"],
  playful: ["#eef0fb", "#ffffff", "#34366a", "#65658b", "#6753ae", "#dcd8f5", "#34366a", "#55547a"],
  rose: ["#fcf0ed", "#fffdf9", "#583935", "#826761", "#a65a57", "#efc8bd", "#583935", "#6c4b45"],
  garage: ["#eef0f2", "#ffffff", "#252d33", "#5c686f", "#365a72", "#253944", "#ffffff", "#bccdd6"],
  performance: ["#eceff0", "#ffffff", "#24292c", "#5e666a", "#ff663f", "#202c32", "#ffffff", "#c3cdd1"]
} as const;

type ThemeDefinition = {
  name: string;
  sector: ThemeSector;
  layout: ThemeLayout;
  font: ThemeFont;
  palette: keyof typeof palettes;
  imageFit: "contain" | "cover";
  description: { fr: string; en: string };
};

function theme(name: string, sector: ThemeSector, layout: ThemeLayout, font: ThemeFont, palette: keyof typeof palettes, imageFit: "contain" | "cover", fr: string, en: string): ThemeDefinition {
  return { name, sector, layout, font, palette, imageFit, description: { fr, en } };
}

// Stable IDs are stored in merchant data. Layout primitives are shared; palettes
// and typography describe the art direction, not a new app per merchant.
export const storeThemes = {
  clean: theme("Clean", "general", "catalog", "sans", "clean", "cover", "Un catalogue clair pour tous les commerces.", "A clear catalog for every business."),
  "fashion-editorial": theme("Éditorial", "fashion", "editorial", "serif", "paper", "cover", "Photographie en grand, récit et typographie éditoriale.", "Large photography, storytelling and editorial type."),
  "fashion-collection": theme("Collection", "fashion", "panels", "display", "clay", "cover", "Des collections présentées en panneaux interactifs.", "Collections presented in interactive panels."),
  "beauty-ecrin": theme("Écrin", "beauty", "spotlight", "serif", "gold", "contain", "Un produit central, de la profondeur et une touche dorée.", "A central product, depth and a golden accent."),
  "beauty-botanique": theme("Botanique", "beauty", "lookbook", "serif", "botanical", "cover", "Une sélection naturelle dans une composition photographique.", "A natural selection in a photographic composition."),
  "tech-precision": theme("Précision", "tech", "catalog", "display", "electric", "contain", "Une sélection structurée pour comparer les produits.", "A structured selection for comparing products."),
  "tech-studio": theme("Studio", "tech", "spotlight", "display", "chrome", "contain", "Le produit au centre d’une scène graphique.", "The product at the center of a graphic scene."),
  "sport-stadium": theme("Stadium", "sport", "spotlight", "display", "stadium", "contain", "Le produit vedette et les couleurs de votre équipe.", "A hero product with your team colors."),
  "sport-club": theme("Club", "sport", "panels", "display", "club", "contain", "Des collections sportives à explorer ensemble.", "Sports collections to explore together."),
  "jewelry-joaillerie": theme("Joaillerie", "jewelry", "spotlight", "serif", "gold", "contain", "Une scène précieuse, sobre et lumineuse.", "A refined, minimal and luminous stage."),
  "jewelry-atelier": theme("Atelier", "jewelry", "editorial", "serif", "paper", "cover", "La matière et le détail prennent la parole.", "Material and detail tell the story."),
  "accessories-street": theme("Street", "accessories", "panels", "display", "ink", "contain", "Une composition affirmée pour vos collections.", "A bold composition for your collections."),
  "accessories-signature": theme("Signature", "accessories", "lookbook", "serif", "plum", "cover", "Un lookbook élégant et des gros plans généreux.", "An elegant lookbook with generous close-ups."),
  "home-habitat": theme("Habitat", "home", "lookbook", "serif", "paper", "cover", "Une composition vivante, inspirée des intérieurs.", "A living composition inspired by interiors."),
  "home-galerie": theme("Galerie", "home", "editorial", "sans", "blue", "cover", "Une galerie aérée pour les objets et les matières.", "An airy gallery for objects and materials."),
  "grocery-marche": theme("Marché", "grocery", "catalog", "sans", "market", "contain", "Les catégories et les prix restent au premier plan.", "Categories and prices stay front and center."),
  "grocery-terroir": theme("Terroir", "grocery", "editorial", "serif", "clay", "cover", "Une photographie chaleureuse au service du produit.", "Warm photography serving the product."),
  "food-menu": theme("Menu", "food", "menu", "sans", "tangerine", "cover", "Une carte visuelle à parcourir par catégorie.", "A visual menu to explore by category."),
  "food-gourmand": theme("Gourmand", "food", "lookbook", "serif", "rose", "cover", "Le produit vedette ouvre une sélection gourmande.", "A hero product opens an inviting selection."),
  "kids-douceur": theme("Douceur", "kids", "editorial", "serif", "rose", "cover", "Des formes apaisées et une présentation douce.", "Calm shapes and a gentle presentation."),
  "kids-play": theme("Play", "kids", "panels", "display", "playful", "contain", "Des couleurs expressives et des collections ludiques.", "Expressive colors and playful collections."),
  "auto-garage": theme("Garage", "auto", "catalog", "sans", "garage", "contain", "Un catalogue organisé pour les pièces et accessoires.", "An organized catalog for parts and accessories."),
  "auto-performance": theme("Performance", "auto", "spotlight", "display", "performance", "contain", "Contraste, volume et détail autour du produit.", "Contrast, volume and detail around the product."),
  "gifts-celebration": theme("Célébration", "gifts", "lookbook", "serif", "plum", "cover", "Une sélection éditoriale pour les occasions.", "An editorial selection for every occasion."),
  "gifts-createur": theme("Créateur", "gifts", "menu", "sans", "botanical", "contain", "Une présentation d’atelier, centrée sur les créations.", "An atelier presentation centered on handmade pieces.")
} as const;

export type StoreTheme = keyof typeof storeThemes;
export const storeThemeIds = Object.keys(storeThemes) as StoreTheme[];
export const themeFonts: Record<ThemeFont, string> = {
  sans: '"Plus Jakarta Sans", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  display: '"Space Grotesk", system-ui, sans-serif'
};

export function isStoreTheme(value: unknown): value is StoreTheme {
  return typeof value === "string" && Object.hasOwn(storeThemes, value);
}

/** Accept only declarative values. No merchant-provided CSS or URLs. */
export function parseThemeSettings(value: unknown): ThemeSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["accent", "font", "imageFit"].includes(key))) return null;
  const result: ThemeSettings = {};
  if (input.accent !== undefined) {
    if (typeof input.accent !== "string" || !/^#[0-9a-f]{6}$/i.test(input.accent)) return null;
    result.accent = input.accent.toLowerCase();
  }
  if (input.font !== undefined) {
    if (input.font !== "sans" && input.font !== "serif" && input.font !== "display") return null;
    result.font = input.font;
  }
  if (input.imageFit !== undefined) {
    if (input.imageFit !== "contain" && input.imageFit !== "cover") return null;
    result.imageFit = input.imageFit;
  }
  return result;
}

export function accentForeground(hex: string): "#000000" | "#ffffff" {
  const channels = hex.slice(1).match(/../g)!.map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function resolveStoreTheme(id: unknown, settings: unknown = {}) {
  const key: StoreTheme = isStoreTheme(id) ? id : "clean";
  const definition = storeThemes[key];
  const custom = parseThemeSettings(settings) ?? {};
  const [background, surface, ink, muted, accent, scene, sceneInk, sceneMuted] = palettes[definition.palette];
  const tokens: ThemeTokens = { background, surface, ink, muted, accent: custom.accent ?? accent, scene, sceneInk, sceneMuted };
  return {
    id: key,
    ...definition,
    tokens,
    font: custom.font ?? definition.font,
    imageFit: custom.imageFit ?? definition.imageFit,
    onAccent: accentForeground(tokens.accent)
  };
}
