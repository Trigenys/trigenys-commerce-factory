import { useId, useState } from "react";
import { resolveStoreTheme, storeThemes, storeThemeIds, themeSectors, type StoreTheme, type ThemeSettings, type ThemeLanguage, type ThemeSector } from "../../shared/store-themes";
import { themeShellProps } from "../storefront/theme-style";
import "./theme-picker.css";

export default function ThemePicker({ value, settings, language, onChange, imageUrl, customization = true }: {
  value: StoreTheme;
  settings: ThemeSettings;
  language: ThemeLanguage;
  onChange: (theme: StoreTheme, settings: ThemeSettings) => void;
  imageUrl?: string;
  customization?: boolean;
}) {
  const [sector, setSector] = useState<ThemeSector | "all">("all");
  const id = useId();
  const selected = resolveStoreTheme(value, settings);
  const themes = storeThemeIds.filter((key) => sector === "all" || storeThemes[key].sector === sector);
  return <fieldset className="theme-picker">
    <legend>{language === "fr" ? "Choisissez votre univers" : "Choose your style"}</legend>
    <div className="theme-picker-toolbar">
      <label htmlFor={id + "-sector"}>{language === "fr" ? "Secteur d’activité" : "Business sector"}</label>
      <select id={id + "-sector"} value={sector} onChange={(event) => setSector(event.target.value as ThemeSector | "all")}>
        <option value="all">{language === "fr" ? "Tous les secteurs" : "All sectors"}</option>
        {Object.entries(themeSectors).map(([key, label]) => <option key={key} value={key}>{label[language]}</option>)}
      </select>
      <small>{language === "fr" ? "Tous les thèmes acceptent votre catalogue." : "Every theme works with your catalog."}</small>
    </div>
    <div className="theme-picker-grid" role="group" aria-label={language === "fr" ? "Thèmes disponibles" : "Available themes"}>
      {themes.map((key) => {
        const theme = resolveStoreTheme(key);
        const props = themeShellProps({ theme: key });
        const fallbackImage = "/landing/" + (theme.sector === "beauty" ? "beauty" : ["fashion", "accessories", "kids"].includes(theme.sector) ? "fashion" : theme.sector === "jewelry" ? "watch" : "electronics") + "-480.webp";
        return <button className="theme-choice" type="button" key={key} aria-pressed={key === value} onClick={() => onChange(key, settings)}>
          <span className="theme-thumbnail" data-layout={theme.layout} style={props.style} aria-hidden="true">
            <span className="theme-thumbnail-title">{theme.name}<i /></span>
            <img src={imageUrl || fallbackImage} alt="" loading="lazy" width="160" height="160" />
            <span className="theme-thumbnail-detail"><i /><i /><i /></span>
          </span>
          <span className="theme-choice-name">{theme.name}<span>{key === value ? "✓" : "↗"}</span></span>
          <small>{themeSectors[theme.sector][language]}</small>
        </button>;
      })}
    </div>
    <p className="theme-selected-description"><b>{selected.name}</b> · {selected.description[language]}</p>
    {customization ? <div className="theme-customization">
      <label><span>{language === "fr" ? "Couleur d’accent" : "Accent color"}</span><input type="color" value={selected.tokens.accent} onChange={(event) => onChange(value, { ...settings, accent: event.target.value })} /></label>
      <label><span>{language === "fr" ? "Typographie" : "Typography"}</span><select aria-label={language === "fr" ? "Typographie" : "Typography"} value={settings.font ?? ""} onChange={(event) => {
        const next = { ...settings }; if (event.target.value) next.font = event.target.value as ThemeSettings["font"]; else delete next.font; onChange(value, next);
      }}><option value="">{language === "fr" ? "Selon le thème" : "Theme default"}</option><option value="sans">Sans serif</option><option value="serif">{language === "fr" ? "Éditoriale" : "Editorial"}</option><option value="display">{language === "fr" ? "Graphique" : "Display"}</option></select></label>
      <label><span>{language === "fr" ? "Images des produits" : "Product images"}</span><select aria-label={language === "fr" ? "Images des produits" : "Product images"} value={settings.imageFit ?? ""} onChange={(event) => {
        const next = { ...settings }; if (event.target.value) next.imageFit = event.target.value as ThemeSettings["imageFit"]; else delete next.imageFit; onChange(value, next);
      }}><option value="">{language === "fr" ? "Selon le thème" : "Theme default"}</option><option value="contain">{language === "fr" ? "Produit entier" : "Whole product"}</option><option value="cover">{language === "fr" ? "Remplir le cadre" : "Fill the frame"}</option></select></label>
      <button type="button" className="theme-reset" onClick={() => onChange(value, {})}>{language === "fr" ? "Rétablir le style du thème" : "Reset theme style"}</button>
    </div> : null}
  </fieldset>;
}
