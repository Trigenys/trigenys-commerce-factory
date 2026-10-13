import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";

export default function AccountMenu({ email, language, onSignOut }: { email: string; language: "fr" | "en"; onSignOut: () => Promise<void> }) {
  const fr = language === "fr";
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <details className="admin-account" ref={ref} onToggle={event => setOpen(event.currentTarget.open)}><summary aria-label={fr ? "Menu du compte" : "Account menu"}><span className="admin-account-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase() || "C"}</span><span className="admin-account-label">{fr ? "Mon compte" : "My account"}</span><AppIcon name="chevron" /></summary><div className="admin-account-panel"><strong>{fr ? "Compte connecté" : "Signed-in account"}</strong><p>{email || (fr ? "Votre compte Commerce Factory" : "Your Commerce Factory account")}</p><a href="/contact">{fr ? "Contacter le support" : "Contact support"}</a><button type="button" className="admin-signout" onClick={() => { if (ref.current) ref.current.open = false; void onSignOut(); }}>{fr ? "Se déconnecter" : "Sign out"}</button></div></details>;
}
