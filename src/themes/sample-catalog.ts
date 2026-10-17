import { resolveStoreTheme, type StoreTheme, type ThemeSettings, type ThemeSector } from "../../shared/store-themes";
import type { PublicProduct, PublicStorefront } from "../storefront/types";
import { themeSampleImage } from "./sample-images";

// Fictional examples demonstrate framing and layout; they cannot be ordered.
function product(id: string, slug: string, name: string, price: string, category: string, sector: ThemeSector, description: string, variants: PublicProduct["variants"] = []): PublicProduct {
  return { id, slug, name, price, category, description, currencyCode: "XAF", stockLabel: "Disponible", imageUrls: [themeSampleImage(sector, 960)], variants };
}
const products = {
  fashion: product("sample-fashion", "ensemble-lin", "Ensemble en lin", "35000", "Vêtements", "fashion", "Une silhouette légère pour accompagner vos journées.", [{ name: "Taille", value: "M" }, { name: "Taille", value: "L" }]),
  beauty: product("sample-beauty", "collection-soins", "Collection de soins", "12500", "Soins", "beauty", "Les essentiels d’un rituel, réunis dans un coffret."),
  botanical: { ...product("sample-botanical", "rituel-botanique", "Rituel botanique", "15000", "Soins", "beauty", "Une autre sélection pour votre rituel quotidien."), imageUrls: ["/landing/beauty-960.webp"] },
  headphones: product("sample-headphones", "casque-studio", "Casque Studio", "35000", "Audio", "tech", "Un design enveloppant pour vos moments de musique.", [{ name: "Couleur", value: "Noir" }, { name: "Couleur", value: "Blanc" }]),
  watch: product("sample-watch", "montre-atelier", "Montre Atelier", "28000", "Montres", "jewelry", "Un accessoire pour accompagner chaque journée."),
  earbuds: { ...product("sample-earbuds", "ecouteurs-pocket", "Écouteurs Pocket", "18000", "Audio", "tech", "Le son vous accompagne partout."), imageUrls: ["/landing/earbuds-960.webp"] },
  tech: { ...product("sample-tech", "selection-connectee", "Sélection connectée", "45000", "Électronique", "tech", "Les essentiels d’un quotidien connecté."), imageUrls: ["/landing/electronics-960.webp"] },
  sport: product("sample-sport", "maillot-tricolore", "Maillot Tricolore", "17000", "Maillots", "sport", "Trois couleurs, une silhouette pensée pour les jours de match.", [{ name: "Taille", value: "M" }, { name: "Taille", value: "L" }]),
  accessories: product("sample-bag", "sac-sillage", "Sac Sillage", "32000", "Sacs", "accessories", "Des lignes courbes, une teinte cognac et des détails discrets."),
  home: product("sample-home", "fauteuil-raphia", "Fauteuil Raphia", "95000", "Mobilier", "home", "Une assise chaleureuse et des matières qui trouvent leur place chez vous."),
  grocery: product("sample-grocery", "panier-fraicheur", "Panier fraîcheur", "6500", "Paniers du marché", "grocery", "Une sélection de légumes et de fruits, réunie dans un panier."),
  food: product("sample-food", "assiette-maison", "L’Assiette Maison", "4500", "À la carte", "food", "Riz, poulet grillé et plantains dorés : les saveurs d’une table généreuse."),
  kids: product("sample-kids", "coffret-petits-soleils", "Coffret Petits Soleils", "18000", "Éveil & douceur", "kids", "Des formes à explorer et une touche de douceur pour le quotidien."),
  auto: product("sample-auto", "roue-graphite", "Roue Graphite", "85000", "Roues & accessoires", "auto", "Un exemple de présentation pour les pièces et les accessoires automobiles."),
  gifts: product("sample-gifts", "coffret-jolis-instants", "Coffret Jolis Instants", "22000", "Coffrets cadeaux", "gifts", "Des attentions réunies, du papier texturé et un ruban à dénouer.")
} satisfies Record<string, PublicProduct>;

type Example = { name: string; description: string; items: (keyof typeof products)[] };
const examples: Record<ThemeSector, Example> = {
  general: { name: "Atelier Commerce", description: "Des essentiels bien choisis. Des détails qui font la différence.", items: ["fashion", "beauty", "headphones", "gifts", "watch", "accessories"] },
  fashion: { name: "Maison Naya", description: "Une silhouette, un mouvement, les détails qui vous ressemblent.", items: ["fashion", "accessories", "watch"] },
  beauty: { name: "Maison Sève", description: "Un peu de temps pour soi. L’essentiel de votre rituel quotidien.", items: ["beauty", "botanical", "gifts"] },
  tech: { name: "Circuit Studio", description: "Du son, du design et les essentiels d’un quotidien connecté.", items: ["headphones", "earbuds", "tech"] },
  sport: { name: "Terrain 237", description: "Des couleurs à porter. De l’énergie à partager, sur le terrain comme en dehors.", items: ["sport", "watch", "headphones"] },
  jewelry: { name: "Atelier Oria", description: "Des détails à regarder de près. Des pièces qui accompagnent vos instants.", items: ["watch"] },
  accessories: { name: "Sillage", description: "Le détail qui signe une silhouette. Des lignes et des matières à emporter.", items: ["accessories", "watch", "fashion"] },
  home: { name: "Maison Raphia", description: "Des matières, de la lumière et des objets à faire entrer chez soi.", items: ["home", "gifts"] },
  grocery: { name: "Le Panier Frais", description: "Des couleurs sur l’étal, des idées dans l’assiette. Composez votre panier.", items: ["grocery"] },
  food: { name: "La Table 237", description: "Le goût des tablées généreuses. Parcourez la carte et choisissez votre assiette.", items: ["food"] },
  kids: { name: "Petits Soleils", description: "Des formes douces, des couleurs joyeuses et de petits instants à explorer.", items: ["kids"] },
  auto: { name: "Garage Studio", description: "La pièce, son détail, son prix. Une sélection à parcourir simplement.", items: ["auto"] },
  gifts: { name: "Jolis Instants", description: "Une attention à offrir, un ruban à dénouer. Trouvez l’idée pour votre occasion.", items: ["gifts", "beauty", "kids"] }
};

export function themeSampleStorefront(theme: StoreTheme, settings: ThemeSettings = {}, productSlug: string | null = null): PublicStorefront {
  const example = examples[resolveStoreTheme(theme).sector];
  const selected = example.items.map((key) => products[key]);
  // Keep previously shared showroom product deep links valid after curation.
  const legacy = Object.values(products).find((item) => item.slug === productSlug);
  if (legacy && !selected.some((item) => item.slug === productSlug)) selected.push(legacy);
  return {
    store: { name: example.name, slug: "atelier-commerce", description: example.description, whatsappNumber: "", countryCode: "CM", currencyCode: "XAF", businessLocation: "Douala, Cameroun", theme, themeSettings: settings, logoUrl: null },
    products: selected
  };
}
