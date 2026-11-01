import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CommerceAuthClient } from "./auth";
import { ApiError, createStore, listProducts, listStores, publishStore, updateStore, type Product, type Store, type StoreInput } from "./api";
import { emptyInput, fieldError, slugify, storeToInput, validStoreDraft } from "./store-input";
import { readDraft, useDraft, useUnsavedChanges } from "../lib/drafts";
import { isStoreTheme, resolveStoreTheme, storeThemeIds, storeThemes, themeSectors, type ThemeSector } from "../../shared/store-themes";
import { themeSampleImage } from "../themes/sample-images";
import ThemePicker from "../themes/ThemePicker";
import ProductCatalog from "./ProductCatalog";
import OnboardingPreview from "./OnboardingPreview";
import { setupCopy } from "./setup-copy";
import "./onboarding.css";

type Language = "fr" | "en";
type Step = 0 | 1 | 2 | 3 | 4;
type Progress = { version: 1; step: Step; storeId: string | null; sector: ThemeSector; slugTouched: boolean };
const featuredSectors: ThemeSector[] = ["fashion", "beauty", "tech", "food", "home", "sport"];
const countries = [
  ["CM", "Cameroun", "Cameroon"], ["CI", "Côte d’Ivoire", "Côte d’Ivoire"],
  ["SN", "Sénégal", "Senegal"], ["GA", "Gabon", "Gabon"], ["CG", "Congo", "Congo"]
];
const currencies = ["XAF", "XOF", "EUR", "USD"];
const currencyForCountry: Record<string, string> = { CM: "XAF", CI: "XOF", SN: "XOF", GA: "XAF", CG: "XAF" };

function validProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object") return false;
  const p = value as Progress;
  return p.version === 1 && Number.isInteger(p.step) && p.step >= 0 && p.step <= 4 &&
    (p.storeId === null || typeof p.storeId === "string" && /^[0-9a-f-]{36}$/i.test(p.storeId)) &&
    Object.hasOwn(themeSectors, p.sector) && typeof p.slugTouched === "boolean";
}

export default function StoreOnboarding({ client, language, email, store, onSaved, onExit }: {
  client: CommerceAuthClient; language: Language; email: string; store: Store | null;
  onSaved: (store: Store) => void; onExit: (store: Store) => void;
}) {
  const t = setupCopy[language], fr = language === "fr";
  // Retain the existing validated draft key, so an unfinished old form can
  // continue here. Public contact email is optional, never inferred from login.
  const draftKey = "commerce-onboarding:" + email + (store ? ":" + store.id : "");
  const draft = useDraft<StoreInput>(draftKey, store ? storeToInput(store) : emptyInput(), validStoreDraft);
  const input = draft.value, setInput = draft.setValue;
  const progressKey = "commerce-onboarding:progress:" + email;
  const progress = useDraft<Progress>(progressKey, {
    version: 1, step: store ? 3 : 0, storeId: store?.id || null,
    sector: resolveStoreTheme(input.theme).sector, slugTouched: Boolean(store)
  }, validProgress);
  const [step, setStep] = useState<Step>(() => {
    const p = readDraft(progressKey, progress.value, validProgress);
    return store ? p.storeId === store.id ? p.step : 3 : Math.min(p.step, 2) as Step;
  });
  const [expandedSectors, setExpandedSectors] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editLink, setEditLink] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [recovered, setRecovered] = useState<Store | null>(null);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productDraft, setProductDraft] = useState<Product | null>(null);
  const [productEditing, setProductEditing] = useState(false);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusStep = useRef(false);
  const dirty = !store || JSON.stringify(input) !== JSON.stringify(storeToInput(store));
  const active = products.filter(product => product.status === "active").length;
  const savedProducts = products.filter(product => product.status !== "archived").length;
  const style = resolveStoreTheme(input.theme, input.themeSettings);
  const sector = progress.value.sector;
  const sectors: ThemeSector[] = expandedSectors ? Object.keys(themeSectors).filter(key => key !== "general") as ThemeSector[] : [...new Set([...featuredSectors, ...(sector === "general" ? [] : [sector])])];
  useUnsavedChanges(!published && Boolean(input.name) && dirty);

  useEffect(() => {
    document.title = t.step + " " + (step + 1) + " " + t.of + " 5 — " + t.heading;
    if (focusStep.current) {
      focusStep.current = false;
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start" });
    }
    return () => { document.title = "Commerce Factory — Merchant"; };
  }, [step, language, t]);

  // The product editor reports its confirmed data while editing. Other steps
  // re-read the same endpoint; cancel stale reads before a step/store change.
  useEffect(() => {
    if (!store || step === 3) return;
    let cancelled = false;
    setCatalogState("loading");
    listProducts(client, store.id).then(value => {
      if (!cancelled) { setProducts(value); setCatalogState("ready"); }
    }).catch(() => { if (!cancelled) setCatalogState("error"); });
    return () => { cancelled = true; };
  }, [client, store?.id, step === 3, attempt]);

  const onProducts = useCallback((value: Product[]) => {
    setProducts(value); setCatalogState("ready");
  }, []);
  const onCatalogState = useCallback((state: "loading" | "ready" | "error") => setCatalogState(state), []);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  function go(next: Step) {
    setError(""); setErrors({});
    progress.setValue({ ...progress.value, step: next, storeId: store?.id || progress.value.storeId });
    focusStep.current = true; setStep(next);
  }
  function report(found: Record<string, string>, next: Step) {
    setErrors(found); setError("");
    if (found.contactEmail) setDetailsOpen(true);
    if (found.slug) setEditLink(true);
    focusStep.current = true; setStep(next);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.setup-fields [aria-invalid="true"]')?.focus());
  }
  function selectSector(next: ThemeSector) {
    const recommended = storeThemeIds.find(key => storeThemes[key].sector === next) || "clean";
    progress.setValue({ ...progress.value, sector: next });
    setInput({ ...input, theme: recommended, themeSettings: {} });
  }
  function advance(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = fieldError(input, step === 1 ? 1 : 0, language);
    if (Object.keys(found).length) { report(found, step); return; }
    go(step === 0 ? 1 : 2);
  }

  async function saveStore(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const identityErrors = fieldError(input, 0, language), contactErrors = fieldError(input, 1, language);
    if (Object.keys(identityErrors).length) { report(identityErrors, 0); return; }
    if (Object.keys(contactErrors).length) { report(contactErrors, 1); return; }
    if (!isStoreTheme(input.theme)) { setError(t.invalidStore); return; }
    setBusy(true); setError(""); setRecovered(null);
    try {
      const saved = store ? await updateStore(client, store.id, input) : await createStore(client, input);
      if (!store) draft.discard();
      setInput(storeToInput(saved));
      progress.setValue({ ...progress.value, step: 3, storeId: saved.id });
      onSaved(saved);
      focusStep.current = true; setStep(3);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "SLUG_TAKEN") { report({ slug: t.slugTaken }, 0); return; }
      setError(cause instanceof ApiError && cause.code === "STORE_ALREADY_EXISTS" ? t.storeExists : cause instanceof ApiError && cause.code === "INVALID_STORE_INPUT" ? t.invalidStore : t.genericError);
      // A lost creation response must not encourage creating another store.
      // Offer the server's saved version explicitly rather than overwriting it.
      if (!store) {
        try {
          const existing = (await listStores(client)).find(item => item.role !== "staff" && item.slug === input.slug && item.status === "draft");
          if (existing) setRecovered(existing);
        } catch { /* The retained local draft remains the recovery path. */ }
      }
    } finally { setBusy(false); }
  }
  function resumeSaved() {
    if (!recovered) return;
    setInput(storeToInput(recovered));
    progress.setValue({ ...progress.value, storeId: recovered.id, step: 3 });
    onSaved(recovered); setRecovered(null); focusStep.current = true; setStep(3); setError("");
  }
  async function publish() {
    if (!store || busy || dirty || productEditing || catalogState !== "ready" || active === 0) return;
    setBusy(true); setError("");
    try {
      const result = await publishStore(client, store.id);
      draft.discard(); progress.discard(); setPublished(result);
      requestAnimationFrame(() => heading.current?.focus());
    } catch { setError(t.publishError); }
    finally { setBusy(false); }
  }

  if (published) return <main className="setup-flow setup-success" id="merchant-main" tabIndex={-1}>
    <span className="setup-success-mark" aria-hidden="true">✓</span>
    <span className="admin-eyebrow">Commerce Factory</span>
    <h1 ref={heading} tabIndex={-1}>{t.success}</h1><p>{t.successBody}</p>
    <p className="setup-public-link">/store/{published.slug}</p>
    <div className="setup-success-actions"><a className="admin-primary" href={"/store/" + encodeURIComponent(published.slug)} target="_blank" rel="noreferrer">{t.open} ↗</a><button type="button" className="admin-secondary" onClick={() => onExit(published)}>{t.workspace}</button></div>
  </main>;

  return <main className="setup-flow" id="merchant-main" tabIndex={-1}>
    <header className="setup-topline">
      <div><span className="admin-eyebrow">{t.heading}</span><p>{t.step} {step + 1} {t.of} 5</p></div>
      {store && <button type="button" className="setup-text-button" disabled={busy || productEditing} onClick={() => onExit(store)}>{t.later} ↗</button>}
    </header>
    <nav aria-label={fr ? "Progression de la création" : "Store setup progress"} className="setup-progress"><ol>
      {t.steps.map((label, index) => {
        const reachable = index <= 2 || Boolean(store && !dirty && (index === 3 || savedProducts > 0 && !productEditing && catalogState === "ready"));
        return <li key={index} className={index === step ? "current" : index < step ? "done" : ""}>
          <button type="button" aria-current={index === step ? "step" : undefined} disabled={busy || !reachable || index > step && !(store && !dirty)} onClick={() => go(index as Step)}>
            <span className="setup-step-number" aria-hidden="true">{index < step ? "✓" : index + 1}</span><span>{label}</span>
          </button>
        </li>;
      })}
    </ol></nav>
    <button className="admin-secondary setup-preview-toggle" type="button" aria-haspopup="dialog" onClick={() => setPreviewOpen(true)}>{t.preview} <span aria-hidden="true">↗</span></button>
    <div className="setup-grid">
      <section className="setup-card" aria-labelledby="setup-step-title">
        <div className="setup-card-heading" key={step}><span className="setup-overline">{String(step + 1).padStart(2, "0")} / 05</span>
          <h1 ref={heading} id="setup-step-title" tabIndex={-1}>{t.titles[step]}</h1><p>{t.bodies[step]}</p>
        </div>
        <p className="setup-save-state" role="status"><span aria-hidden="true">○</span>{!draft.available || !progress.available ? t.noStorage : store && !dirty ? t.savedDraft : t.localDraft}</p>
        {step === 0 && <form className="setup-fields" onSubmit={advance} noValidate>
          <label><span>{t.name}</span><input aria-label={t.name} value={input.name} maxLength={120} autoComplete="organization" aria-describedby="setup-name-hint" aria-invalid={Boolean(errors.name)} onChange={event => {
            const name = event.target.value; setInput({ ...input, name, slug: progress.value.slugTouched ? input.slug : slugify(name) });
          }} /><small id="setup-name-hint">{errors.name || t.nameHint}</small></label>
          <div className="setup-link"><div><span>{t.link}</span><button type="button" className="setup-text-button" onClick={() => setEditLink(!editLink)} aria-expanded={editLink}>{t.editLink}</button></div>
            {editLink ? <label><span className="visually-hidden">{fr ? "Adresse de la boutique" : "Store address"}</span><div className="slug-field"><small>/store/</small><input aria-label={fr ? "Adresse de la boutique" : "Store address"} value={input.slug} maxLength={63} aria-invalid={Boolean(errors.slug)} onChange={event => { progress.setValue({ ...progress.value, slugTouched: true }); setInput({ ...input, slug: slugify(event.target.value) }); }} /></div></label> : <p>/store/<strong>{input.slug || (fr ? "votre-boutique" : "your-store")}</strong></p>}
            <small className={errors.slug ? "field-error" : ""}>{errors.slug || t.linkHint}</small>
          </div>
          <fieldset className="setup-sectors"><legend>{t.sector} <small>{t.optional}</small></legend><div className="setup-sector-grid">
            {sectors.map(key => <button type="button" className="setup-sector" key={key} aria-pressed={sector === key} onClick={() => selectSector(key)}>
              <img src={themeSampleImage(key)} alt="" width="100" height="84" loading="lazy" /><span>{themeSectors[key][language]}</span><i aria-hidden="true">{sector === key ? "✓" : "↗"}</i>
            </button>)}
          </div><div className="setup-sector-options"><button type="button" className="setup-text-button" aria-expanded={expandedSectors} onClick={() => setExpandedSectors(!expandedSectors)}>{expandedSectors ? t.fewerSectors : t.moreSectors}</button><button type="button" className="setup-text-button" aria-pressed={sector === "general"} onClick={() => selectSector("general")}>{t.allRetail}</button></div></fieldset>
          <details className="setup-optional" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary>{t.details} <small>{t.optional}</small></summary><div className="setup-optional-fields">
            <label><span>{t.description}</span><textarea aria-label={t.description} value={input.description} maxLength={280} rows={3} onChange={event => setInput({ ...input, description: event.target.value })} /></label>
            <label><span>{t.location}</span><input aria-label={t.location} value={input.businessLocation} maxLength={280} onChange={event => setInput({ ...input, businessLocation: event.target.value })} /></label>
            <label><span>{t.email}</span><input aria-label={t.email} type="email" value={input.contactEmail} maxLength={280} aria-invalid={Boolean(errors.contactEmail)} onChange={event => setInput({ ...input, contactEmail: event.target.value })} /><small className={errors.contactEmail ? "field-error" : ""}>{errors.contactEmail || t.publicEmailHint}</small></label>
          </div></details>
          <div className="setup-actions"><span>{t.private}</span><button type="submit" className="admin-primary">{t.next} →</button></div>
        </form>}
        {step === 1 && <form className="setup-fields" onSubmit={advance} noValidate>
          <label><span>{t.phone}</span><div className="setup-phone"><span aria-hidden="true">↗</span><input aria-label={t.phone} type="tel" autoComplete="tel" inputMode="tel" value={input.whatsappNumber} maxLength={30} placeholder="670 00 00 01" aria-describedby="setup-phone-hint" aria-invalid={Boolean(errors.whatsappNumber)} onChange={event => setInput({ ...input, whatsappNumber: event.target.value })} /></div><small id="setup-phone-hint" className={errors.whatsappNumber ? "field-error" : ""}>{errors.whatsappNumber || t.phoneHint}</small></label>
          <div className="setup-conversation"><span>{t.conversation} · {input.name || t.heading}</span><p>{t.message}</p><small>{fr ? "Illustration — aucun message n’est envoyé." : "Illustration — no message is sent."}</small></div>
          <details className="setup-optional"><summary>{t.preferences}<small>{input.countryCode} · {input.currencyCode}</small></summary><div className="setup-optional-fields">
            <label><span>{t.country}</span><select aria-label={t.country} value={input.countryCode} onChange={event => {
              const countryCode = event.target.value;
              setInput({ ...input, countryCode, currencyCode: input.currencyCode === currencyForCountry[input.countryCode] ? currencyForCountry[countryCode] : input.currencyCode });
            }}>{countries.map(([code, french, english]) => <option key={code} value={code}>{fr ? french : english}</option>)}</select></label>
            <label><span>{t.currency}</span><select aria-label={t.currency} value={input.currencyCode} onChange={event => setInput({ ...input, currencyCode: event.target.value })}>{currencies.map(code => <option key={code} value={code}>{code === "XAF" ? "XAF — FCFA CEMAC" : code === "XOF" ? "XOF — FCFA UEMOA" : code}</option>)}</select></label>
          </div></details>
          <div className="setup-actions"><button className="admin-secondary" type="button" onClick={() => go(0)}>← {t.back}</button><button type="submit" className="admin-primary">{t.next} →</button></div>
        </form>}
        {step === 2 && <form className="setup-fields" onSubmit={saveStore}>
          <fieldset disabled={busy} className="setup-style-controls"><p className="setup-context">{t.themeHint}</p>
            <ThemePicker key={sector} value={input.theme} settings={input.themeSettings} language={language} initialSector={sector === "general" ? "all" : sector} compact onChange={(theme, themeSettings) => setInput({ ...input, theme, themeSettings })} />
          </fieldset>
          <div className="setup-actions"><button className="admin-secondary" type="button" onClick={() => go(1)} disabled={busy}>← {t.back}</button><button type="submit" className="admin-primary" disabled={busy}>{busy ? t.saving : t.saveStyle} →</button></div>
        </form>}
        {/* Keep the editor mounted when moving back, preserving selected local
            files as well as the existing validated product draft. */}
        {store && <div hidden={step !== 3} className="setup-first-product">
          <ProductCatalog client={client} store={store} language={language} guided
            onProductsChange={onProducts} onEditorPreviewChange={setProductDraft}
            onEditorOpenChange={setProductEditing} onCatalogStateChange={onCatalogState} />
          {productEditing && <p className="setup-context">{t.saveProductFirst}</p>}
          <div className="setup-actions"><button className="admin-secondary" type="button" disabled={busy} onClick={() => go(2)}>← {t.back}</button><button className="admin-primary" type="button" disabled={productEditing || savedProducts === 0 || catalogState !== "ready"} onClick={() => go(4)}>{t.check} →</button></div>
        </div>}
        {step === 4 && store && <div className="setup-review">
          <div className="setup-review-heading"><h2>{t.review}</h2><span className="setup-private-pill">{t.private}</span></div>
          <dl>
            <div><dt>{t.name}</dt><dd>{store.name}</dd><button className="setup-text-button" type="button" onClick={() => go(0)}>{t.edit}</button></div>
            <div><dt>{t.link}</dt><dd>/store/{store.slug}</dd><button className="setup-text-button" type="button" onClick={() => go(0)}>{t.edit}</button></div>
            <div><dt>WhatsApp</dt><dd>{store.whatsappNumber}</dd><button className="setup-text-button" type="button" onClick={() => go(1)}>{t.edit}</button></div>
            <div><dt>{t.contactReview}</dt><dd>{[store.businessLocation, store.contactEmail].filter(Boolean).join(" · ") || t.notSet}</dd><button className="setup-text-button" type="button" onClick={() => { setDetailsOpen(true); go(0); }}>{t.edit}</button></div>
            <div><dt>{fr ? "Thème" : "Theme"}</dt><dd>{style.name} · {store.currencyCode}</dd><button className="setup-text-button" type="button" onClick={() => go(2)}>{t.edit}</button></div>
            <div><dt>{t.products}</dt><dd>{catalogState === "ready" ? active : "…"}</dd><button className="setup-text-button" type="button" onClick={() => go(3)}>{t.edit}</button></div>
          </dl>
          {catalogState === "loading" && <p role="status">{t.loading}</p>}
          {catalogState === "error" && <div className="form-message error" role="alert">{t.loadError} <button type="button" className="setup-text-button" onClick={() => setAttempt(value => value + 1)}>{t.retry}</button></div>}
          {catalogState === "ready" && active === 0 && <p className="setup-context">{t.noActive}</p>}
          <div className="setup-actions setup-review-actions"><button className="admin-secondary" type="button" disabled={busy || productEditing || dirty} onClick={() => onExit(store)}>{t.keepDraft}</button><button className="admin-primary" type="button" disabled={busy || dirty || productEditing || catalogState !== "ready" || active === 0} onClick={publish}>{busy ? t.publishing : t.publish} ↗</button></div>
        </div>}
        {error && <div role="alert" className="form-message error setup-operation-error">{error}{recovered && <button type="button" className="admin-secondary" onClick={resumeSaved}>{t.recover}</button>}</div>}
      </section>
      <OnboardingPreview client={client} input={input} store={store} products={products} productDraft={productDraft} language={language} open={previewOpen} onClose={closePreview} />
    </div>
  </main>;
}
