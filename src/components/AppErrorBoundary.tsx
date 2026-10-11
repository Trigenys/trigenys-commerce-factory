import { Component, type ErrorInfo, type ReactNode } from "react";
import { preferredLanguage } from "../lib/language";
import "./recovery.css";
import RecoveryState from "./RecoveryState";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* The UI never displays internal errors or private state. */ }
  render() {
    const language=preferredLanguage();
    if (this.state.failed) return language === "en" ? <RecoveryState language="en" title="This page encountered a problem" message="Reload to resume. Your saved data is preserved." retry={()=>window.location.reload()} /> : <RecoveryState title="Cette page a rencontré un problème" message="Rechargez la page pour reprendre. Vos données déjà enregistrées sont conservées." retry={() => window.location.reload()} />;
    return this.props.children;
  }
}
