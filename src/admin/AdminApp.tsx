import MerchantWorkspace from "./MerchantWorkspace";
import StoreOnboarding from "./StoreOnboarding";
import LocationInput from "./LocationInput";
import { resolveStoreTheme, themeFonts } from "../../shared/store-themes";
import { themeShellProps } from "../storefront/theme-style";
import { slugify, initials, validStoreDraft, storeToInput, fieldError } from "./store-input";
import AccountMenu from "./AccountMenu";
import MerchantNotice, { useMerchantNotice } from "./MerchantNotice";
import AppIcon from "./AppIcon";
import { workspacePage, workspaceRoute, workspaceTitle } from "./workspace-pages";
import WorkspaceFooter from "../brand/WorkspaceFooter";
import InvitationAccept from "./InvitationAccept";
import PlatformPanel from "./PlatformPanel";
import { preferredLanguage, rememberLanguage } from "../lib/language";
import "../pages/public-pages.css";
import AccountAccess from "./AccountAccess";
import RecoveryState from "../components/RecoveryState";
import { useDraft, useUnsavedChanges } from "../lib/drafts";
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useChromeHeight } from "./merchant-chrome";
import type { CommerceAuthClient } from "./auth";
import { canSignInWithGoogle, getAuthClient, getSessionSnapshot } from "./auth";
import { finishGoogleReturn } from "./google-access";
import { finishEmailLinkReturn } from "./email-link-access";
import { captureSocialReturn } from "./social-return";
import {
  ApiError,
  deleteMediaByPublicId,
  listStores,
  listProducts,
  managedMediaPublicId,
  publishStore,
  updateStore,
  updateStoreLogo,
  uploadMedia,
  type Store,
  type StoreInput,
  type Product
} from "./api";
import { MediaPreparationError, prepareImageForUpload } from "./media";
import "./admin.css";
import "../brand/workspace-brand.css";
import ThemePicker from "../themes/ThemePicker";
import { useMerchantMedia } from "./use-merchant-media";
import MerchantThemePreview from "./MerchantThemePreview";
import MerchantImage from "./MerchantImage";

type Language = "fr" | "en";
const copy = {
  fr: {
    back: "Retour au site",
    signIn: "Connexion",
    signUp: "Créer un compte",
    authTitle: "Construisez votre boutique.",
    authBody: "Un compte suffit pour créer votre boutique Commerce Factory et commencer votre catalogue.",
    name: "Votre nom",
    email: "Email",
    password: "Mot de passe",
    passwordHint: "8 caractères minimum",
    continue: "Continuer",
    creatingAccount: "Création du compte…",
    signingIn: "Connexion…",
    haveAccount: "J’ai déjà un compte",
    needAccount: "Créer un compte",
    authError: "Impossible de vous authentifier. Vérifiez vos informations.",
    accountCreated: "Compte créé. Connectez-vous pour continuer.",
    loading: "Chargement de votre espace…",
    signOut: "Se déconnecter",
    onboardingEyebrow: "Configuration de la boutique",
    onboardingTitle: "Votre boutique, sans labyrinthe.",
    onboardingBody: "Renseignez l’essentiel maintenant. Le catalogue et la publication arrivent juste après.",
    businessTitle: "Parlez-nous de votre activité",
    businessBody: "Ces informations deviennent la base de votre boutique publique.",
    storeName: "Nom de la boutique",
    slug: "Adresse de la boutique",
    description: "Courte description",
    location: "Localisation",
    contactEmail: "Email de contact",
    country: "Pays",
    currency: "Devise",
    whatsappTitle: "Où vos clients vous écrivent-ils ?",
    whatsappBody: "Indiquez le numéro où vos clients pourront vous joindre sur WhatsApp.",
    whatsapp: "Numéro WhatsApp",
    whatsappHint: "Ex. 670 00 00 01 ou +237 670 00 00 01",
    appearanceTitle: "Un univers pour votre boutique",
    appearanceBody: "Choisissez une présentation adaptée à votre activité, puis personnalisez son style. Vous pourrez ajouter votre logo après la création.",
    theme: "Thème",
    logoSoon: "Logo",
    logoSoonBody: "Créez d’abord la boutique, puis ajoutez un logo optimisé depuis les paramètres.",
    reviewTitle: "Vérifiez avant de créer",
    reviewBody: "La boutique sera créée en brouillon. Rien n’est publié sans votre action.",
    previous: "Retour",
    next: "Suivant",
    create: "Créer ma boutique",
    creating: "Création…",
    slugTaken: "Cette adresse de boutique est déjà utilisée. Choisissez-en une autre.",
    storeExists: "Votre compte possède déjà une boutique.",
    invalidStore: "Certains champs sont invalides. Vérifiez le formulaire.",
    genericError: "Une erreur est survenue. Réessayez.",
    required: "Champ requis.",
    invalidEmail: "Adresse email invalide.",
    invalidPhone: "Entrez un numéro WhatsApp camerounais valide ou un numéro international commençant par +.",
    invalidSlug: "Utilisez au moins 3 caractères avec lettres, chiffres et tirets.",
    settingsEyebrow: "Ma boutique",
    settingsTitle: "Paramètres de la boutique",
    settingsBody: "Actualisez les coordonnées de votre boutique, puis enregistrez vos modifications.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Modifications enregistrées.",
    draft: "Brouillon",
    published: "Publiée",
    publish: "Publier la boutique",
    publishing: "Publication…",
    publishNeedsProduct: "Activez au moins un produit avant de publier la boutique.",
    openStore: "Ouvrir la boutique",
    publicUrl: "URL publique",
    nextProduct: "Étape suivante : premier produit",
    nextProductBody: "La boutique existe. La prochaine issue branche la création du catalogue, puis le bouton Publier.",
    comingNext: "Bientôt avec #5",
    preview: "Aperçu",
    noDescription: "Votre description apparaîtra ici.",
    noLocation: "Votre localisation apparaîtra ici.",
    fcfaReady: "FCFA prêt",
    secure: "Données isolées par boutique",
    logoUpload: "Logo de la boutique",
    logoUploadHint: "JPEG, PNG ou WebP. Optimisé automatiquement avant l’envoi.",
    chooseLogo: "Choisir un logo",
    removeLogo: "Retirer le logo",
    logoUploading: "Optimisation et envoi…",
    logoSaved: "Logo mis à jour.",
    mediaUnsupported: "Format non pris en charge. Utilisez JPEG, PNG ou WebP.",
    mediaTooLarge: "Image trop lourde. Utilisez une image source de moins de 12 Mo.",
    mediaUploadFailed: "Impossible d’envoyer l’image pour le moment."
  },
  en: {
    back: "Back to site",
    signIn: "Sign in",
    signUp: "Create account",
    authTitle: "Build your store.",
    authBody: "One account is enough to create your Commerce Factory store and start your catalog.",
    name: "Your name",
    email: "Email",
    password: "Password",
    passwordHint: "8 characters minimum",
    continue: "Continue",
    creatingAccount: "Creating account…",
    signingIn: "Signing in…",
    haveAccount: "I already have an account",
    needAccount: "Create an account",
    authError: "Unable to authenticate. Check your details.",
    accountCreated: "Account created. Sign in to continue.",
    loading: "Loading your workspace…",
    signOut: "Sign out",
    onboardingEyebrow: "Store setup",
    onboardingTitle: "Your store, without the dashboard maze.",
    onboardingBody: "Set the essentials now. Catalog and publishing come immediately after.",
    businessTitle: "Tell us about your business",
    businessBody: "These details become the foundation of your public storefront.",
    storeName: "Store name",
    slug: "Store address",
    description: "Short description",
    location: "Business location",
    contactEmail: "Contact email",
    country: "Country",
    currency: "Currency",
    whatsappTitle: "Where should customers message you?",
    whatsappBody: "Enter the number customers can use to reach you on WhatsApp.",
    whatsapp: "WhatsApp number",
    whatsappHint: "E.g. 670 00 00 01 or +237 670 00 00 01",
    appearanceTitle: "A style for your storefront",
    appearanceBody: "Choose a presentation for your business and customize its style. You can add your logo after creating the store.",
    theme: "Theme",
    logoSoon: "Logo",
    logoSoonBody: "Create the store first, then add an optimized logo from store settings.",
    reviewTitle: "Review before creation",
    reviewBody: "The store is created as a draft. Nothing is published without your action.",
    previous: "Back",
    next: "Next",
    create: "Create my store",
    creating: "Creating…",
    slugTaken: "That store address is already taken. Choose another one.",
    storeExists: "Your account already owns a store.",
    invalidStore: "Some fields are invalid. Check the form.",
    genericError: "Something went wrong. Try again.",
    required: "Required field.",
    invalidEmail: "Invalid email address.",
    invalidPhone: "Enter a valid Cameroon WhatsApp number or an international number starting with +.",
    invalidSlug: "Use at least 3 characters with letters, numbers and hyphens.",
    settingsEyebrow: "My store",
    settingsTitle: "Store settings",
    settingsBody: "Update your store contact details, then save your changes.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Changes saved.",
    draft: "Draft",
    published: "Published",
    publish: "Publish store",
    publishing: "Publishing…",
    publishNeedsProduct: "Activate at least one product before publishing the store.",
    openStore: "Open storefront",
    publicUrl: "Public URL",
    nextProduct: "Next step: first product",
    nextProductBody: "Your store exists. The next issue wires catalog creation, then the Publish action.",
    comingNext: "Coming with #5",
    preview: "Preview",
    noDescription: "Your description will appear here.",
    noLocation: "Your location will appear here.",
    fcfaReady: "FCFA-ready",
    secure: "Store-isolated data",
    logoUpload: "Store logo",
    logoUploadHint: "JPEG, PNG or WebP. Automatically optimized before upload.",
    chooseLogo: "Choose logo",
    removeLogo: "Remove logo",
    logoUploading: "Optimizing and uploading…",
    logoSaved: "Logo updated.",
    mediaUnsupported: "Unsupported format. Use JPEG, PNG or WebP.",
    mediaTooLarge: "Image is too large. Use a source image under 12 MB.",
    mediaUploadFailed: "Unable to upload the image right now."
  }
} as const;

function languageFromPreference(): Language { return preferredLanguage(); }

function BrandPreview({
  input,
  language
}: {
  input: StoreInput;
  language: Language;
}) {
  const t = copy[language];
  const theme = resolveStoreTheme(input.theme, input.themeSettings);
  return (
    <aside className="merchant-preview" aria-label={t.preview}>
      <span className="merchant-preview-label">{t.preview}</span>
      <div className="merchant-preview-phone" style={{ ...themeShellProps(input).style, background: theme.tokens.background, color: theme.tokens.ink }}>
        <div className="merchant-preview-top">
          <span className="merchant-preview-logo">{initials(input.name).toUpperCase()}</span>
          <div>
            <strong>{input.name || "Commerce Store"}</strong>
            <small>{input.businessLocation || t.noLocation}</small>
          </div>
          <b>{input.currencyCode}</b>
        </div>
        <div className="merchant-preview-hero" style={{ background: theme.tokens.scene, color: theme.tokens.sceneInk }}>
          <span style={{ color: theme.tokens.sceneMuted }}>{t.fcfaReady}</span>
          <h3 style={{ fontFamily: themeFonts[theme.font] }}>{input.name || "Commerce Store"}</h3>
          <p style={{ color: theme.tokens.sceneMuted }}>{input.description || t.noDescription}</p>
        </div>
        <div className="merchant-preview-product">
          <i />
          <div><strong>{language === "fr" ? "Votre premier produit" : "Your first product"}</strong><small>{language === "fr" ? "Prix" : "Price"} • {input.currencyCode}</small></div>
        </div>
        <div className="merchant-preview-wa">WA · WhatsApp</div>
      </div>
      <small className="merchant-secure-note">✓ {t.secure}</small>
    </aside>
  );
}

function BusinessFields({
  input,
  setInput,
  errors,
  t,
  language,
  slugTouched,
  setSlugTouched
}: {
  input: StoreInput;
  setInput: (input: StoreInput) => void;
  errors: Record<string, string>;
  t: typeof copy.fr | typeof copy.en;
  language: Language;
  slugTouched: boolean;
  setSlugTouched: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="admin-form admin-form-grid">
      <label className="span-2">
        <span>{t.storeName}</span>
        <input
          aria-label={t.storeName}
            aria-describedby={errors.name ? id+"-name-error" : undefined}
          value={input.name}
          onChange={(event) => {
            const name = event.target.value;
            setInput({
              ...input,
              name,
              slug: slugTouched ? input.slug : slugify(name)
            });
          }}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <small id={id+"-name-error"} className="field-error">{errors.name}</small> : null}
      </label>

      <label className="span-2">
        <span>{t.slug}</span>
        <div className="slug-field">
          <small>/store/</small>
          <input
            aria-label={t.slug}
            aria-describedby={errors.slug ? id+"-slug-error" : undefined}
            value={input.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setInput({ ...input, slug: slugify(event.target.value) });
            }}
            aria-invalid={Boolean(errors.slug)}
          />
        </div>
        {errors.slug ? <small id={id+"-slug-error"} className="field-error">{errors.slug}</small> : null}
      </label>

      <label className="span-2">
        <span>{t.description}</span>
        <textarea
          aria-label={t.description}
          value={input.description}
          maxLength={280}
          rows={3}
          onChange={(event) => setInput({ ...input, description: event.target.value })}
        />
        <small>{input.description.length}/280</small>
      </label>

      <LocationInput key={input.countryCode} label={t.location} value={input.businessLocation} countryCode={input.countryCode} language={language} error={errors.businessLocation} onChange={businessLocation => setInput({ ...input, businessLocation })} />

      <label>
        <span>{t.contactEmail}</span>
        <input
          type="email"
          aria-label={t.contactEmail}
            aria-describedby={errors.contactEmail ? id+"-contactEmail-error" : undefined}
          value={input.contactEmail}
          onChange={(event) => setInput({ ...input, contactEmail: event.target.value })}
          aria-invalid={Boolean(errors.contactEmail)}
        />
        {errors.contactEmail ? <small id={id+"-contactEmail-error"} className="field-error">{errors.contactEmail}</small> : null}
      </label>

      <label>
        <span>{t.country}</span>
        <select
          aria-label={t.country}
          value={input.countryCode}
          onChange={(event) => setInput({ ...input, countryCode: event.target.value })}
        >
          <option value="CM">Cameroun</option>
          <option value="CI">Côte d’Ivoire</option>
          <option value="SN">Sénégal</option>
          <option value="GA">Gabon</option>
          <option value="CG">Congo</option>
        </select>
      </label>

      <label>
        <span>{t.currency}</span>
        <select
          aria-label={t.currency}
          value={input.currencyCode}
          onChange={(event) => setInput({ ...input, currencyCode: event.target.value })}
        >
          <option value="XAF">XAF — FCFA CEMAC</option>
          <option value="XOF">XOF — FCFA UEMOA</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </label>
    </div>
  );
}

function StoreSettings({
  client,
  store,
  language,
  onUpdated,
  section = "settings"
}: {
  client: CommerceAuthClient;
  store: Store;
  language: Language;
  onUpdated: (store: Store) => void;
  section?: "settings" | "appearance";
}) {
  const t = copy[language];
  const draft = useDraft("commerce-settings:"+store.id, storeToInput(store), validStoreDraft);
  const input = draft.value;
  const setInput = draft.setValue;
  const dirty = JSON.stringify(input) !== JSON.stringify(storeToInput(store));
  useUnsavedChanges(dirty);
  const [slugTouched, setSlugTouched] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const [previewReload, setPreviewReload] = useState(0);
  const previewImage = previewProducts.find(product => product.status !== "archived" && product.imageUrls.length)?.imageUrls[0];
  const { sources: themeImages } = useMerchantMedia(client, store.id, previewImage ? [previewImage] : []);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useChromeHeight(toolbarRef, "--merchant-page-toolbar-height");
  const { notice, notify, dismiss } = useMerchantNotice();
  useEffect(() => {
    if (serverError) notify("error", serverError);
    else if (message) notify("success", message);
    else dismiss();
  }, [serverError, message, notify, dismiss]);

  useEffect(() => {
    let cancelled = false;
    if (section === "appearance") {
      setPreviewState("loading");
      listProducts(client, store.id).then(value => {
        if (!cancelled) { setPreviewProducts(value); setPreviewState("ready"); }
      }).catch(() => { if (!cancelled) setPreviewState("error"); });
    }
    return () => { cancelled = true; };
  }, [client, store.id, section, previewReload]);

  async function publishCurrentStore() {
    setPublishBusy(true);
    setMessage(null);
    setServerError(null);
    try {
      const published = await publishStore(client, store.id);
      onUpdated(published);
      setMessage(t.published);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "ACTIVE_PRODUCT_REQUIRED"
      ) {
        setServerError(t.publishNeedsProduct);
      } else {
        setServerError(t.genericError);
      }
    } finally {
      setPublishBusy(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    setMessage(null);
    setServerError(null);

    try {
      const prepared = await prepareImageForUpload(file);
      const media = await uploadMedia(client, store.id, prepared, "logo");
      const previousPublicId = store.logoUrl
        ? managedMediaPublicId(store.logoUrl)
        : null;
      const updated = await updateStoreLogo(client, store.id, media.publicUrl);
      onUpdated(updated);
      setMessage(t.logoSaved);

      if (previousPublicId && previousPublicId !== media.publicId) {
        try {
          await deleteMediaByPublicId(client, store.id, previousPublicId);
        } catch {
          // Best-effort cleanup; the documented orphan sweep is the fallback.
        }
      }
    } catch (error) {
      if (error instanceof MediaPreparationError) {
        setServerError(
          error.code === "UNSUPPORTED_MEDIA_TYPE"
            ? t.mediaUnsupported
            : error.code.includes("TOO_LARGE")
              ? t.mediaTooLarge
              : t.mediaUploadFailed
        );
      } else {
        setServerError(t.mediaUploadFailed);
      }
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    if (!store.logoUrl) return;
    setLogoBusy(true);
    setMessage(null);
    setServerError(null);
    const publicId = managedMediaPublicId(store.logoUrl);

    try {
      const updated = await updateStoreLogo(client, store.id, null);
      onUpdated(updated);
      if (publicId) {
        try {
          await deleteMediaByPublicId(client, store.id, publicId);
        } catch {
          // Best-effort cleanup; the documented orphan sweep is the fallback.
        }
      }
      setMessage(t.logoSaved);
    } catch {
      setServerError(t.mediaUploadFailed);
    } finally {
      setLogoBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const found = {
      ...fieldError(input, 0, language),
      ...fieldError(input, 1, language)
    };
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setMessage(null);
    setServerError(null);
    try {
      const updated = await updateStore(client, store.id, input);
      onUpdated(updated);
      setInput(storeToInput(updated));
      draft.discard();
      setMessage(t.saved);
    } catch (error) {
      if (error instanceof ApiError && error.code === "SLUG_TAKEN") {
        setServerError(t.slugTaken);
      } else {
        setServerError(t.genericError);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-layout">
      <section className="settings-main">
        <MerchantNotice notice={notice} language={language} onDismiss={dismiss} />
        <div ref={toolbarRef} className="settings-title-row workspace-page-heading">
          <div>
            <h1>{section === "appearance" ? (language === "fr" ? "L’apparence de votre boutique" : "Your store appearance") : t.settingsTitle}</h1>
            <p>{section === "appearance" ? (language === "fr" ? "Choisissez un thème, personnalisez son style et vérifiez l’aperçu de votre boutique." : "Choose a theme, customize its style and check your store preview.") : t.settingsBody}</p>
          </div>
          <div className="store-status-actions">
            <span className={"draft-pill " + store.status}>
              {store.status === "published" ? t.published : t.draft}
            </span>
            {store.status === "published" ? (
              <a
                className="admin-secondary storefront-link"
                href={"/store/" + encodeURIComponent(store.slug)}
                target="_blank"
                rel="noreferrer"
              >
                {t.openStore}
              </a>
            ) : (
              <button
                type="button"
                className="admin-primary publish-button"
                onClick={publishCurrentStore}
                disabled={publishBusy}
              >
                {publishBusy ? t.publishing : t.publish}
              </button>
            )}
            <button className="admin-primary" type="submit" form="merchant-settings" disabled={busy || logoBusy}>
              {busy ? t.saving : t.save}
            </button>
          </div>
        </div>

        <form id="merchant-settings" className="merchant-form-card settings-card" onSubmit={save}>
          <div hidden={section === "appearance"}>
          <div className="workspace-form-heading"><h2>{language === "fr" ? "Informations de la boutique" : "Store information"}</h2><p>{language === "fr" ? "L’identité et les coordonnées présentées à vos clients." : "The identity and contact details shown to your customers."}</p></div>
          <BusinessFields
            input={input}
            setInput={setInput}
            errors={errors}
            t={t}
            language={language}
            slugTouched={slugTouched}
            setSlugTouched={setSlugTouched}
          />

          </div>
          {section === "settings" && <div className="settings-divider" />}

          <div className="admin-form admin-form-grid">
            <label hidden={section === "appearance"}>
              <span>{t.whatsapp}</span>
              <input
                aria-label={t.whatsapp}
                value={input.whatsappNumber}
                onChange={(event) => setInput({ ...input, whatsappNumber: event.target.value })}
                aria-invalid={Boolean(errors.whatsappNumber)}
              />
              {errors.whatsappNumber ? <small className="field-error">{errors.whatsappNumber}</small> : null}
            </label>
            <div className="span-2 store-logo-field" hidden={section !== "appearance"}>
              <span>{t.logoUpload}</span>
              <div className="store-logo-row">
                <div className="store-logo-preview">
                  {store.logoUrl ? (
                    <MerchantImage client={client} storeId={store.id} url={store.logoUrl} language={language} />
                  ) : (
                    <span>{initials(store.name).toUpperCase()}</span>
                  )}
                </div>
                <div className="store-logo-actions">
                  <label className="admin-secondary store-logo-upload">
                    <span>{logoBusy ? t.logoUploading : t.chooseLogo}</span>
                    <input
                      type="file"
                      aria-label={t.chooseLogo}
                      accept="image/jpeg,image/png,image/webp"
                      disabled={logoBusy}
                      onChange={(event) => {
                        void uploadLogo(event.currentTarget.files?.[0] || null);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {store.logoUrl ? (
                    <button
                      type="button"
                      className="admin-secondary"
                      onClick={() => void removeLogo()}
                      disabled={logoBusy}
                    >
                      {t.removeLogo}
                    </button>
                  ) : null}
                  <small>{t.logoUploadHint}</small>
                </div>
              </div>
            </div>
          </div>

          {section === "appearance" && <div className="settings-divider" />}
          <div hidden={section !== "appearance"}>
          <ThemePicker value={input.theme} settings={input.themeSettings} language={language} imageUrl={previewImage ? themeImages[previewImage] : undefined} onChange={(theme, themeSettings) => setInput({ ...input, theme, themeSettings })} />

          </div>
          <p className="draft-note" role="status">{dirty ? (language === "fr" ? "Modifications non enregistrées · brouillon conservé dans cet onglet." : "Unsaved changes · draft kept in this tab.") : (language === "fr" ? "Vos réglages sont enregistrés." : "Your settings are saved.")}</p>

          <div className="settings-actions">
            <span>
              <small>{t.publicUrl}</small>
              <strong>/store/{input.slug}</strong>
            </span>
            <span>{language === "fr" ? "Enregistrez depuis le haut de la page." : "Save using the action at the top of the page."}</span>
          </div>
        </form>

        {section === "appearance" && <MerchantThemePreview client={client} storeId={store.id} language={language}
          store={{ ...store, ...input, logoUrl: store.logoUrl }} products={previewProducts}
          published={store.status === "published"} dirty={dirty} catalogState={previewState}
          onRetryProducts={() => setPreviewReload(value => value + 1)} />}

      </section>

      <BrandPreview input={input} language={language} />
    </div>
  );
}

export default function AdminApp() {
  const headerRef = useRef<HTMLElement>(null);
  useChromeHeight(headerRef, "--merchant-header-height");
  const [language, setLanguage] = useState<Language>(languageFromPreference);
  const [client, setClient] = useState<CommerceAuthClient | null>(null);
  const [sessionEmail, setSessionEmail] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const [authenticated, setAuthenticated] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [googleFeedback, setGoogleFeedback] = useState<"failed" | "missing-session" | null>(null);
  const [emailLinkFeedback, setEmailLinkFeedback] = useState<"failed" | "missing-session" | null>(null);
  const [setupRequested, setSetupRequested] = useState(() => new URLSearchParams(window.location.search).get("setup") === "1");

  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = "Commerce Factory — Merchant";
    rememberLanguage(language);
  }, [language]);

  async function hydrate(nextClient: CommerceAuthClient) {
    const session = await getSessionSnapshot(nextClient);
    setEmailLinkFeedback(finishEmailLinkReturn(session.authenticated));
    setGoogleFeedback(finishGoogleReturn(session.authenticated));
    setAuthenticated(session.authenticated);
    setSessionEmail(session.email);
    if (!session.authenticated) {
      setStore(null);
      return;
    }

    const nextStores = await listStores(nextClient);
    setStores(nextStores);
    setSetupRequested(new URLSearchParams(window.location.search).get("setup") === "1");
    const wanted = new URLSearchParams(window.location.search).get("store");
    setStore(nextStores.find(item => item.id === wanted) || nextStores[0] || null);
  }

  useEffect(() => {
    let cancelled = false;
    captureSocialReturn();
    (async () => {
      try {
        const nextClient = await getAuthClient();
        if (cancelled) return;
        // Better Auth exposes a callable proxy; React must store it as a value.
        setClient(() => nextClient);
        await hydrate(nextClient);
      } catch {
        if (!cancelled) {
          setFatalError(
            language === "fr"
              ? "Impossible de charger la configuration Commerce Factory."
              : "Unable to load Commerce Factory configuration."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    const expire = () => { setAuthenticated(false); setSessionEmail(""); };
    window.addEventListener("merchant-session-expired", expire);
    return () => window.removeEventListener("merchant-session-expired", expire);
  }, []);

  const guidedSetup = authenticated && (!store || setupRequested && store.role !== "staff" && store.status === "draft");
  const workspaceMode = authenticated && Boolean(store) && !guidedSetup && !loading && !fatalError && window.location.pathname !== "/app/accept-invitation";
  const signOut = useCallback(async () => {
    if (!client) return;
    try { const result = await client.signOut(); if (result.error) throw new Error("SIGN_OUT_FAILED"); }
    catch { setFatalError(language === "fr" ? "La déconnexion n’a pas abouti. Réessayez." : "Sign out did not complete. Try again."); return; }
    try { for (const key of Object.keys(sessionStorage)) if (/^commerce-(onboarding|settings|product):/.test(key)) sessionStorage.removeItem(key); } catch { /* Optional storage. */ }
    closeNavigation(); setAuthenticated(false); setStore(null); setSessionEmail("");
  }, [client, language, closeNavigation]);
  const header = useMemo(() => (
    <header ref={headerRef} className="admin-header">
      <a className="skip-link" href="#merchant-main">{language === "fr" ? "Aller au contenu" : "Skip to content"}</a>
      <div className="admin-header-left">
      {workspaceMode && <button type="button" className="workspace-icon-button workspace-navigation-toggle" aria-label={language === "fr" ? "Ouvrir la navigation" : "Open navigation"} aria-expanded={navigationOpen} aria-controls="merchant-navigation" aria-haspopup="dialog" onClick={() => setNavigationOpen(true)}><AppIcon name="menu" /></button>}
      <a href={workspaceMode && store ? workspaceRoute(store.id, "overview") : "/"} className="admin-brand">
        <img src="/commerce-factory-logo-v3.png?v=3" alt="Commerce Factory" width={500} height={159} />
      </a>
      </div>
      {workspaceMode && <nav className="admin-breadcrumb" aria-label={language === "fr" ? "Fil d’Ariane" : "Breadcrumb"}><span>{language === "fr" ? "Mon espace" : "Workspace"}</span><span aria-hidden="true">/</span><span aria-current="page">{workspaceTitle(workspacePage(), language)}</span></nav>}
      <div className="admin-header-actions">
        <a className="admin-back" href="/help">{language === "fr" ? "Aide" : "Help"}</a>
        <div className="admin-language">
          <button
            type="button"
            className={language === "fr" ? "active" : ""}
            aria-pressed={language === "fr"}
            onClick={() => setLanguage("fr")}
          >FR</button>
          <button
            type="button"
            className={language === "en" ? "active" : ""}
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >EN</button>
        </div>
        {authenticated && client ? <AccountMenu email={sessionEmail} language={language} onSignOut={signOut} /> : (
          <a href="/" className="admin-back">{t.back}</a>
        )}
      </div>
    </header>
  ), [authenticated, client, language, t, workspaceMode, store, navigationOpen, sessionEmail, signOut]);

  if (loading) {
    return (
      <div className="admin-shell brand-page">
        {header}
        <main className="admin-loading" id="merchant-main" tabIndex={-1}>
          <span className="admin-loader" aria-hidden="true" />
          <p role="status">{t.loading}</p>
        </main>
        <WorkspaceFooter language={language} />
      </div>
    );
  }

  if (fatalError || !client) {
    return (
      <div className="admin-shell brand-page">
        {header}
        <RecoveryState language={language} title={language === "fr" ? "Votre espace est temporairement indisponible" : "Your workspace is temporarily unavailable"} message={language === "fr" ? "Vérifiez votre connexion puis réessayez. Vos données enregistrées sont conservées." : "Check your connection and try again. Your saved data is safe."} retry={() => { setFatalError(null);setLoading(true);setAttempt(value=>value+1); }} />
        <WorkspaceFooter language={language} />
      </div>
    );
  }

  return (
    <div className={"admin-shell brand-page" + (workspaceMode ? " workspace-mode" : "")}>
      {header}
      {!authenticated ? (
        <AccountAccess
          client={client}
          language={language}
          googleEnabled={canSignInWithGoogle()}
          googleFeedback={googleFeedback}
          emailLinkEnabled={import.meta.env.VITE_MAGIC_LINK_ENABLED === "true"}
          emailLinkFeedback={emailLinkFeedback}
          onAuthenticated={async () => {
            await hydrate(client);
          }}
        />
      ) : window.location.pathname === "/app/accept-invitation" ? (
        <InvitationAccept client={client} language={language} />
      ) : window.location.pathname === "/app/platform" && !store ? (
        <main id="merchant-main" tabIndex={-1}><PlatformPanel client={client} language={language} /></main>
      ) : guidedSetup ? (
        <StoreOnboarding key={sessionEmail} client={client} language={language} email={sessionEmail} store={store}
          onSaved={(saved) => {
            window.history.replaceState(null, "", workspaceRoute(saved.id, "overview") + "&setup=1");
            setSetupRequested(true); setStore(saved);
            setStores(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
          }}
          onExit={(saved) => {
            window.history.replaceState(null, "", workspaceRoute(saved.id, "overview"));
            setStore(saved); setSetupRequested(false);
            setStores(current => current.map(item => item.id === saved.id ? saved : item));
          }} />
      ) : store ? (
        <MerchantWorkspace client={client} store={store} stores={stores.length ? stores : [store]} language={language} onUpdated={setStore}
          navigationOpen={navigationOpen} onCloseNavigation={closeNavigation}
          renderSettings={(section) => <StoreSettings key={store.id+section} client={client} store={store} language={language} section={section} onUpdated={setStore} />} />
      ) : null}
      <WorkspaceFooter language={language} />
    </div>
  );
}

