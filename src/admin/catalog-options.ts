type Language = "fr" | "en";
const suggestions = {
  fr: ["Vêtements", "Accessoires", "Chaussures", "Beauté", "Soins", "Électronique", "Informatique", "Maison et décoration", "Alimentation et boissons", "Sport", "Livres et papeterie", "Services"],
  en: ["Clothing", "Accessories", "Shoes", "Beauty", "Skin care", "Electronics", "Computing", "Home and decor", "Food and drinks", "Sports", "Books and stationery", "Services"]
};
const stockLabels = [
  { fr: "En stock", en: "In stock" },
  { fr: "Stock limité", en: "Limited stock" },
  { fr: "Sur commande", en: "Made to order" },
  { fr: "Précommande", en: "Pre-order" },
  { fr: "Rupture de stock", en: "Out of stock" },
  { fr: "À confirmer", en: "To be confirmed" }
];
export const categoryKey = (value: string) => value.normalize("NFKC").trim().toLowerCase();

export function categoryChoices(values: (string | null | undefined)[], language: Language) {
  const seen = new Set<string>();
  const unique = (items: (string | null | undefined)[]) => items.filter((value): value is string => {
    if (!value?.trim() || seen.has(categoryKey(value))) return false;
    seen.add(categoryKey(value));
    return true;
  });
  const existing = unique(values);
  const proposed = unique(suggestions[language]);
  let addValue = "__add_category__";
  while (seen.has(categoryKey(addValue))) addValue += "_";
  return { existing, proposed, addValue };
}

export function stockChoices(current: string, language: Language) {
  let recognized = !current;
  const choices = stockLabels.map(labels => {
    const selected = current && Object.values(labels).some(label => categoryKey(label) === categoryKey(current));
    if (selected) recognized = true;
    return { value: selected ? current : labels[language], label: labels[language] };
  });
  if (!recognized) choices.unshift({ value: current, label: current });
  return choices;
}
