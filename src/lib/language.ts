export function preferredLanguage():"fr"|"en" {
  try {return localStorage.getItem("commerce-factory-language")==="en" ? "en" : "fr";} catch {return "fr";}
}
export function rememberLanguage(value:"fr"|"en") {try {localStorage.setItem("commerce-factory-language",value);} catch { /* Preference is optional. */ }}
