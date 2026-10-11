export default function RecoveryState({ title, message, retry, language = "fr" }: {
  title: string; message: string; retry?: () => void; language?: "fr" | "en";
}) {
  return <main className="recovery-state" id="merchant-main" tabIndex={-1}>
    <span className="admin-eyebrow">Commerce Factory</span>
    <h1>{title}</h1><p role="alert">{message}</p>
    <div className="recovery-actions">
      {retry && <button type="button" className="admin-primary" onClick={retry}>{language === "fr" ? "Réessayer" : "Try again"}</button>}
      <a href="/help">{language === "fr" ? "Obtenir de l’aide" : "Get help"}</a>
      <a href="/">{language === "fr" ? "Retour à l’accueil" : "Back home"}</a>
    </div>
  </main>;
}
