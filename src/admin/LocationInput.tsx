import { useId } from "react";
import { useCombobox } from "downshift";
import { locationSuggestions } from "./location-suggestions";
import "./location-input.css";

type Option = { value: string; custom: boolean };
const copy = {
  fr: {
    toggle: "Afficher les suggestions de localisation", placeholder: "Ville, quartier ou repère",
    hint: "Choisissez une suggestion ou gardez votre saisie. Vous pouvez préciser le quartier après une virgule.",
    keep: "Conserver", empty: "Laisser vide", city: "Localité suggérée", custom: "Votre localisation personnalisée", source: "Suggestions non exhaustives",
    results: "suggestions. Utilisez les flèches puis Entrée pour choisir."
  },
  en: {
    toggle: "Show location suggestions", placeholder: "City, neighbourhood or landmark",
    hint: "Choose a suggestion or keep what you type. Add a neighbourhood after a comma.",
    keep: "Keep", empty: "Leave blank", city: "Suggested place", custom: "Your custom location", source: "Suggestions are not exhaustive",
    results: "suggestions. Use the arrow keys and Enter to choose."
  }
};

export default function LocationInput({ value, onChange, countryCode, language, label, error, disabled = false }: {
  value: string; onChange: (value: string) => void; countryCode: string;
  language: "fr" | "en"; label: string; error?: string; disabled?: boolean;
}) {
  const t = copy[language], id = useId();
  const cities = locationSuggestions(value, countryCode);
  const options: Option[] = cities.map(city => ({ value: city, custom: false }));
  if ((value.trim() || cities.length === 0) && !cities.includes(value)) options.push({ value, custom: true });
  const { isOpen, highlightedIndex, getLabelProps, getInputProps, getToggleButtonProps, getMenuProps, getItemProps } = useCombobox<Option>({
    id, items: options, inputValue: value, defaultHighlightedIndex: -1,
    itemToString: item => item?.value || "",
    itemToKey: item => item ? String(item.custom) + ":" + item.value : null,
    onInputValueChange: ({ inputValue }) => { if (inputValue !== value) onChange(inputValue); },
    // Manual selection: moving focus or pressing Escape never corrects text.
    stateReducer: (state, { type, changes }) => type === useCombobox.stateChangeTypes.InputBlur || type === useCombobox.stateChangeTypes.InputKeyDownEscape
      ? { ...changes, inputValue: state.inputValue, selectedItem: state.selectedItem } : changes,
    getA11yStatusMessage: state => state.isOpen ? options.length + " " + t.results : ""
  });
  return <div className="location-field">
    <label {...getLabelProps()}>{label}</label>
    <div className="location-control">
      <input {...getInputProps({ disabled, maxLength: 180, placeholder: t.placeholder, "aria-describedby": id + "-hint", "aria-invalid": Boolean(error) })} />
      <button {...getToggleButtonProps({ disabled, "aria-label": t.toggle })} type="button" className="location-toggle"><span aria-hidden="true">⌄</span></button>
      <ul {...getMenuProps()} className="location-options" hidden={!isOpen}>
        {isOpen && options.map((item, index) => <li {...getItemProps({ item, index })} key={String(item.custom) + item.value} data-highlighted={highlightedIndex === index}>
          <span>{item.custom ? item.value.trim() ? <>{t.keep} « {item.value} »</> : t.empty : item.value}</span>
          <small>{item.custom ? t.custom : t.city}</small>
        </li>)}
      </ul>
    </div>
    <small id={id + "-hint"} className={error ? "field-error" : ""}>{error || t.hint}</small>
    <small className="location-source">{t.source} · <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></small>
  </div>;
}
