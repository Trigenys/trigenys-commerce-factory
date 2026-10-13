export default function WorkspaceFooter({ language }: { language: "fr" | "en" }) {
  const fr = language === "fr";
  return <footer className="workspace-footer">
    <span>Commerce Factory · Trigenys</span>
    <nav aria-label={fr ? "Liens utiles" : "Useful links"}><a href="/help">{fr ? "Aide" : "Help"}</a><a href="/contact">Contact</a><a href="/privacy">{fr ? "Confidentialité" : "Privacy"}</a><a href="/terms">{fr ? "Conditions" : "Terms"}</a></nav>
    <small>© {new Date().getFullYear()}</small>
  </footer>;
}
