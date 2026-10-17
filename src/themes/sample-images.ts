import type { ThemeSector } from "../../shared/store-themes";

// These paths belong to the fictional showroom, never to merchant inventory.
const prefixes: Record<ThemeSector, string> = {
  general: "/landing/electronics",
  fashion: "/landing/fashion",
  beauty: "/themes/beauty-v1",
  tech: "/landing/headphones",
  sport: "/themes/sport-v1",
  jewelry: "/landing/watch",
  accessories: "/themes/accessories-v1",
  home: "/themes/home-v1",
  grocery: "/themes/grocery-v1",
  food: "/themes/food-v1",
  kids: "/themes/kids-v1",
  auto: "/themes/auto-v1",
  gifts: "/themes/gifts-v1"
};

export function themeSampleImage(sector: ThemeSector, width: 480 | 960 = 480): string {
  return prefixes[sector] + "-" + width + ".webp";
}
