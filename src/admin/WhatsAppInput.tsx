import { useId, type FocusEventHandler } from "react";
import PhoneInput, { getCountryCallingCode, isSupportedCountry, parsePhoneNumber, type Country } from "react-phone-number-input";
import french from "react-phone-number-input/locale/fr";
import english from "react-phone-number-input/locale/en";
import "./whatsapp-input.css";

type CountrySelectProps = {
  value?: Country;
  onChange: (country?: Country) => void;
  options: { value?: Country; label: string; divider?: boolean }[];
  disabled?: boolean;
  readOnly?: boolean;
  onFocus?: FocusEventHandler<HTMLSelectElement>;
  onBlur?: FocusEventHandler<HTMLSelectElement>;
  tabIndex?: number;
  "aria-label"?: string;
};

// Use the library's country/number state and native select keyboard behaviour.
// Text labels keep the calling code visible without fetching remote flag images.
function CallingCodeSelect({ value, onChange, options, disabled, readOnly, onFocus, onBlur, tabIndex, "aria-label": label }: CountrySelectProps) {
  return <select className="whatsapp-country" aria-label={label} value={value || "ZZ"} disabled={disabled || readOnly} onFocus={onFocus} onBlur={onBlur} tabIndex={tabIndex} onChange={event => onChange(event.target.value === "ZZ" ? undefined : event.target.value as Country)}>
    {options.map((option, index) => <option key={option.value || "ZZ-" + index} value={option.divider ? "|" : option.value || "ZZ"} disabled={option.divider}>
      {option.label}{option.value ? " (+" + getCountryCallingCode(option.value) + ")" : ""}
    </option>)}
  </select>;
}

// Older drafts accepted these two Cameroon formats. Normalize only for display;
// mounting the field must never turn an unchanged saved store into a dirty one.
export function phoneDisplayValue(value: string, country: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (country === "CM" && /^2376\d{8}$/.test(digits)) return "+" + digits;
  if (isSupportedCountry(country)) return parsePhoneNumber(trimmed, country as Country)?.number || "+" + getCountryCallingCode(country as Country) + digits;
  return "+" + digits;
}

export default function WhatsAppInput({ label, value, countryCode, language, error, onChange, hidden = false }: {
  label: string; value: string; countryCode: string; language: "fr" | "en";
  error?: string; onChange: (value: string) => void; hidden?: boolean;
}) {
  const id = useId(), fr = language === "fr";
  const country = isSupportedCountry(countryCode) ? countryCode as Country : undefined;
  return <div className="whatsapp-number-field" hidden={hidden}>
    <label htmlFor={id}>{label}</label>
    <PhoneInput id={id} className="whatsapp-input" countrySelectComponent={CallingCodeSelect}
      countrySelectProps={{ "aria-label": fr ? "Indicatif WhatsApp" : "WhatsApp calling code" }}
      labels={fr ? french : english} defaultCountry={country} initialValueFormat="national"
      countryOptionsOrder={["CM", "CI", "SN", "GA", "CG", "FR", "..."]}
      value={phoneDisplayValue(value, countryCode)} onChange={next => onChange(next || "")}
      autoComplete="tel" inputMode="tel" aria-invalid={Boolean(error)} aria-describedby={id + "-hint"}
      placeholder={fr ? "Votre numéro" : "Your number"} />
    <small id={id + "-hint"} className={error ? "field-error" : ""}>{error || (fr ? "Indicatif modifiable. Vous pouvez aussi coller le numéro complet avec +." : "You can change the calling code or paste a full number starting with +.")}</small>
  </div>;
}
