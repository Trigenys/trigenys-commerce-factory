import { useDraft, useUnsavedChanges } from "../lib/drafts";
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import MerchantNotice, { useMerchantNotice } from "./MerchantNotice";
import AppIcon from "./AppIcon";
import MerchantImage from "./MerchantImage";
import { categoryChoices, categoryKey, stockChoices } from "./catalog-options";
import type { CommerceAuthClient } from "./auth";
import {
  ApiError,
  archiveProduct,
  deleteMediaByPublicId,
  createProduct,
  duplicateProduct,
  listProducts,
  managedMediaPublicId,
  updateProduct,
  setProductStatus,
  uploadMedia,
  type Product,
  type ProductInput,
  type ProductVariant,
  type Store
} from "./api";
import { MediaPreparationError, prepareImageForUpload } from "./media";
import "./catalog.css";

type Language = "fr" | "en";

const copy = {
  fr: {
    eyebrow: "Catalogue",
    title: "Vos produits",
    body: "Ajoutez les produits que vos clients verront dans votre boutique et classez-les dans l’ordre voulu.",
    add: "Ajouter un produit",
    loading: "Chargement du catalogue…",
    loadError: "Impossible de charger le catalogue.",
    emptyTitle: "Votre catalogue est vide.",
    emptyBody: "Créez votre premier produit avec un prix, une image et les informations utiles au client.",
    name: "Nom du produit",
    slug: "Adresse produit",
    price: "Prix",
    category: "Catégorie",
    noCategory: "Sans catégorie",
    existingCategories: "Catégories de la boutique",
    suggestedCategories: "Suggestions",
    addCategory: "Ajouter une catégorie…",
    categoryName: "Nouvelle catégorie",
    useCategory: "Ajouter",
    categoryHint: "La catégorie sera enregistrée avec le produit.",
    categoryRequired: "Saisissez le nom de la catégorie.",
    stock: "Indication de stock",
    description: "Description",
    status: "Visibilité",
    draft: "Brouillon",
    active: "Actif",
    activate: "Activer",
    hide: "Mettre en brouillon",
    changingVisibility: "Mise à jour…",
    activated: "Produit activé.",
    hidden: "Produit mis en brouillon. Il est masqué de la boutique publique.",
    publishFirst: "Publiez la boutique pour le rendre visible aux clients.",
    visible: "Visible sur la boutique",
    notVisible: "Masqué de la boutique publique",
    notPublished: "Actif · boutique non publiée",
    closeEditorForStatus: "Enregistrez ou fermez la fiche pour changer sa visibilité ici.",
    viewProduct: "Voir le produit",
    archived: "Archivé",
    images: "Images",
    imagesHint: "JPEG, PNG ou WebP. Nous optimisons automatiquement en WebP, max 8 images. Après l’envoi, cliquez sur Enregistrer pour associer les images au produit.",
    uploadImages: "Ajouter des images",
    uploading: "Optimisation et envoi…",
    removeImage: "Retirer",
    createdAddImages: "Produit créé. Vous pouvez maintenant ajouter ses images.",
    mediaUnsupported: "Format non pris en charge. Utilisez JPEG, PNG ou WebP.",
    mediaTooLarge: "Image trop lourde. Utilisez une image source de moins de 12 Mo.",
    mediaUploadFailed: "Impossible d’envoyer l’image pour le moment.",
    variants: "Variantes",
    variantsHint: "Une par ligne au format Nom: Valeur. Ex. Couleur: Noir",
    save: "Enregistrer",
    create: "Créer le produit",
    cancel: "Annuler",
    edit: "Modifier",
    duplicate: "Dupliquer",
    archive: "Archiver",
    archiveConfirm: "Archiver ce produit ? Il disparaîtra de la boutique publique.",
    moveUp: "Monter",
    moveDown: "Descendre",
    invalid: "Vérifiez le nom, le prix, la catégorie, le stock, les images et les variantes.",
    slugTaken: "Cette adresse produit existe déjà dans votre boutique.",
    genericError: "Une erreur est survenue. Réessayez.",
    imagePending: "Aucune image",
    variantsLabel: "variantes",
    stockDefault: "Stock non précisé",
    archivedHint: "Ce produit reste dans l’historique mais n’est plus modifiable.",
    saved: "Produit enregistré.",
    duplicated: "Produit dupliqué.",
    archivedDone: "Produit archivé.",
    reordered: "Ordre des produits enregistré.",
    refreshLater: "Le catalogue n’a pas pu être actualisé pour le moment."
  },
  en: {
    eyebrow: "Catalog",
    title: "Your products",
    body: "Add the products customers will see in your store and control their display order.",
    add: "Add product",
    loading: "Loading catalog…",
    loadError: "Unable to load the catalog.",
    emptyTitle: "Your catalog is empty.",
    emptyBody: "Create your first product with a price, image and useful customer details.",
    name: "Product name",
    slug: "Product address",
    price: "Price",
    category: "Category",
    noCategory: "No category",
    existingCategories: "Store categories",
    suggestedCategories: "Suggestions",
    addCategory: "Add a category…",
    categoryName: "New category",
    useCategory: "Add",
    categoryHint: "The category will be saved with the product.",
    categoryRequired: "Enter the category name.",
    stock: "Stock label",
    description: "Description",
    status: "Visibility",
    draft: "Draft",
    active: "Active",
    activate: "Activate",
    hide: "Move to draft",
    changingVisibility: "Updating…",
    activated: "Product activated.",
    hidden: "Product moved to draft. It is hidden from the public store.",
    publishFirst: "Publish the store to make it visible to customers.",
    visible: "Visible in the store",
    notVisible: "Hidden from the public store",
    notPublished: "Active · store not published",
    closeEditorForStatus: "Save or close the editor to change visibility here.",
    viewProduct: "View product",
    archived: "Archived",
    images: "Images",
    imagesHint: "JPEG, PNG or WebP. We optimize automatically to WebP, maximum 8 images. After uploading, click Save to attach the images to the product.",
    uploadImages: "Add images",
    uploading: "Optimizing and uploading…",
    removeImage: "Remove",
    createdAddImages: "Product created. You can now add its images.",
    mediaUnsupported: "Unsupported format. Use JPEG, PNG or WebP.",
    mediaTooLarge: "Image is too large. Use a source image under 12 MB.",
    mediaUploadFailed: "Unable to upload the image right now.",
    variants: "Variants",
    variantsHint: "One per line as Name: Value. Example Color: Black",
    save: "Save",
    create: "Create product",
    cancel: "Cancel",
    edit: "Edit",
    duplicate: "Duplicate",
    archive: "Archive",
    archiveConfirm: "Archive this product? It will disappear from the public storefront.",
    moveUp: "Move up",
    moveDown: "Move down",
    invalid: "Check the name, price, category, stock, images and variants.",
    slugTaken: "That product address is already used in this store.",
    genericError: "Something went wrong. Try again.",
    imagePending: "No image",
    variantsLabel: "variants",
    stockDefault: "Stock not specified",
    archivedHint: "This product stays in history but can no longer be edited.",
    saved: "Product saved.",
    duplicated: "Product duplicated.",
    archivedDone: "Product archived.",
    reordered: "Product order saved.",
    refreshLater: "The catalog could not be refreshed right now."
  }
} as const;

type EditorState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  price: string;
  currencyCode: string;
  category: string;
  stockLabel: string;
  status: "draft" | "active";
  imageText: string;
  variantText: string;
  sortOrder: number;
};

function validEditorDraft(value: unknown): value is EditorState | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const editor = value as EditorState;
  return (editor.id === null || typeof editor.id === "string") && [editor.name, editor.slug, editor.description, editor.price, editor.currencyCode, editor.category, editor.stockLabel, editor.imageText, editor.variantText].every(field => typeof field === "string" && field.length <= 10000) && ["draft", "active"].includes(editor.status) && Number.isSafeInteger(editor.sortOrder) && editor.sortOrder >= 0;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

function editorFromProduct(product: Product): EditorState {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    price: product.price.replace(/\.00$/, ""),
    currencyCode: product.currencyCode,
    category: product.category || "",
    stockLabel: product.stockLabel || "",
    status: product.status === "active" ? "active" : "draft",
    imageText: product.imageUrls.join("\n"),
    variantText: product.variants
      .map((variant) => variant.name + ": " + variant.value)
      .join("\n"),
    sortOrder: product.sortOrder
  };
}

function blankEditor(store: Store, sortOrder: number): EditorState {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    price: "",
    currencyCode: store.currencyCode,
    category: "",
    stockLabel: "",
    status: "draft",
    imageText: "",
    variantText: "",
    sortOrder
  };
}

function parseImages(value: string): string[] | null {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 8 || new Set(lines).size !== lines.length) return null;

  for (const line of lines) {
    try {
      const url = new URL(line);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.hash
      ) return null;
    } catch {
      return null;
    }
  }
  return lines;
}

function parseVariants(value: string): ProductVariant[] | null {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 24) return null;

  const variants: ProductVariant[] = [];
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0) return null;
    const name = line.slice(0, separator).trim();
    const variantValue = line.slice(separator + 1).trim();
    if (
      name.length < 1 ||
      name.length > 60 ||
      variantValue.length < 1 ||
      variantValue.length > 80
    ) return null;
    variants.push({ name, value: variantValue });
  }
  return variants;
}

function toInput(editor: EditorState): ProductInput | null {
  const images = parseImages(editor.imageText);
  const variants = parseVariants(editor.variantText);
  const price = editor.price.trim();
  if (
    editor.name.trim().length < 1 ||
    editor.name.trim().length > 180 ||
    editor.slug.trim().length < 2 ||
    editor.category.trim().length > 80 ||
    editor.stockLabel.trim().length > 80 ||
    !/^\d{1,12}(?:\.\d{1,2})?$/.test(price) ||
    !images ||
    !variants
  ) {
    return null;
  }

  return {
    name: editor.name.trim(),
    slug: slugify(editor.slug),
    description: editor.description.trim() || null,
    price,
    currencyCode: editor.currencyCode,
    category: editor.category.trim() || null,
    stockLabel: editor.stockLabel.trim() || null,
    status: editor.status,
    sortOrder: editor.sortOrder,
    imageUrls: images,
    variants
  };
}

function productToInput(product: Product, sortOrder = product.sortOrder): ProductInput {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    currencyCode: product.currencyCode,
    category: product.category,
    stockLabel: product.stockLabel,
    status: product.status === "active" ? "active" : "draft",
    sortOrder,
    imageUrls: product.imageUrls,
    variants: product.variants
  };
}

function formatMoney(value: string, currencyCode: string, language: Language) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value + " " + currencyCode;
  const noDecimals = currencyCode === "XAF" || currencyCode === "XOF";
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2
  }).format(amount);
}

export default function ProductCatalog({
  client,
  store,
  language,
  onProductsChange
}: {
  client: CommerceAuthClient;
  store: Store;
  language: Language;
  onProductsChange?: (products: Product[]) => void;
}) {
  const t = copy[language];
  const [products, setProducts] = useState<Product[]>([]);
  const draft = useDraft<EditorState | null>("commerce-product:"+store.id, null, validEditorDraft);
  const editor = draft.value;
  const setEditor = draft.setValue;
  useUnsavedChanges(Boolean(editor));
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState<string | null>(null);
  const [error, setInlineError] = useState<string | null>(null);
  const { notice, notify, dismiss } = useMerchantNotice();
  const setError = useCallback((value: string | null) => {
    setInlineError(value);
    if (value) notify("error", value);
  }, [notify]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  const categoryNameRef = useRef<HTMLInputElement>(null);
  const categoryHelpId = useId();
  const [mediaBusy, setMediaBusy] = useState(false);
  const [pendingDeleteUrls, setPendingDeleteUrls] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const nameRef = useRef<HTMLInputElement>(null);
  const focusEditor = useRef(false);
  const newRequested = useRef(new URLSearchParams(window.location.search).get("new") === "1" && !editor);
  useEffect(() => {
    if (editor && focusEditor.current) { focusEditor.current = false; nameRef.current?.focus(); }
  }, [editor?.id, Boolean(editor)]);

  const ordered = useMemo(
    () => [...products].sort((a, b) => {
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      return a.sortOrder - b.sortOrder;
    }),
    [products]
  );
  const categories = useMemo(() => categoryChoices([editor?.category, ...products.map(product => product.category)], language), [editor?.category, products, language]);
  const stocks = stockChoices(editor?.stockLabel || "", language);
  const normalizedQuery = query.trim().toLocaleLowerCase(language);
  const visibleProducts = ordered.filter(product => (statusFilter === "all" || product.status === statusFilter) && (!normalizedQuery || [product.name, product.category, product.slug].some(value => value?.toLocaleLowerCase(language).includes(normalizedQuery))));

  useEffect(() => {
    if (addingCategory) categoryNameRef.current?.focus();
  }, [addingCategory]);

  function resetCategoryEntry(returnFocus = false) {
    setAddingCategory(false);
    setCategoryName("");
    if (returnFocus) categorySelectRef.current?.focus();
  }

  function addCategory() {
    if (!editor) return;
    const name = categoryName.trim();
    if (!name) {
      categoryNameRef.current?.setCustomValidity(t.categoryRequired);
      categoryNameRef.current?.reportValidity();
      return;
    }
    if (!categoryNameRef.current?.reportValidity()) return;
    const existing = [...categories.existing, ...categories.proposed].find(value => categoryKey(value) === categoryKey(name));
    setEditor({ ...editor, category: existing || name });
    resetCategoryEntry(true);
  }

  async function reload() {
    const next = await listProducts(client, store.id);
    setProducts(next);
    onProductsChange?.(next);
  }

  function cacheProduct(product: Product) {
    setProducts(current => current.some(item => item.id === product.id)
      ? current.map(item => item.id === product.id ? product : item)
      : [...current, product]);
  }

  async function refreshAfterMutation(message: string) {
    // A confirmed mutation must not look like a failed save when this read fails.
    notify("success", message);
    try { await reload(); }
    catch { notify("success", message + " " + t.refreshLater); }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listProducts(client, store.id);
        if (!cancelled) {
          setProducts(next); onProductsChange?.(next);
          if (newRequested.current) {
            newRequested.current = false; focusEditor.current = true;
            setEditor(blankEditor(store, Math.max(0, ...next.map(product => product.sortOrder)) + 10));
          }
        }
      } catch {
        if (!cancelled) setError(t.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, store.id, language, onProductsChange, setError]);

  function startCreate() {
    if (busy || mediaBusy) return;
    if (editor && !window.confirm(language === "fr" ? "Remplacer le brouillon en cours ?" : "Replace the current draft?")) return;
    const maxOrder = products.reduce(
      (max, product) => Math.max(max, product.sortOrder),
      0
    );
    setEditor(blankEditor(store, maxOrder + 10));
    focusEditor.current = true;
    setSlugTouched(false);
    setError(null);
    dismiss();
    resetCategoryEntry();
    setPendingDeleteUrls([]);
  }

  function startEdit(product: Product) {
    if (busy || mediaBusy) return;
    if (editor && !window.confirm(language === "fr" ? "Remplacer le brouillon en cours ?" : "Replace the current draft?")) return;
    if (product.status === "archived") return;
    setEditor(editorFromProduct(product));
    focusEditor.current = true;
    setSlugTouched(true);
    setError(null);
    dismiss();
    resetCategoryEntry();
    setPendingDeleteUrls([]);
  }

  async function uploadImages(files: FileList | null) {
    if (!editor?.id || !files?.length) return;
    const current = editor.imageText
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (current.length + files.length > 8) {
      setError(t.invalid);
      return;
    }

    setMediaBusy(true);
    setError(null);
    try {
      const next = [...current];
      for (const file of Array.from(files)) {
        const prepared = await prepareImageForUpload(file);
        const media = await uploadMedia(
          client,
          store.id,
          prepared,
          "product",
          editor.id
        );
        next.push(media.publicUrl);
        setEditor({ ...editor, imageText: next.join("\n") });
      }
    } catch (cause) {
      if (cause instanceof MediaPreparationError) {
        setError(
          cause.code === "UNSUPPORTED_MEDIA_TYPE"
            ? t.mediaUnsupported
            : cause.code.includes("TOO_LARGE")
              ? t.mediaTooLarge
              : t.mediaUploadFailed
        );
      } else {
        setError(t.mediaUploadFailed);
      }
    } finally {
      setMediaBusy(false);
    }
  }

  function removeImage(url: string) {
    if (!editor || busy || mediaBusy) return;
    const next = editor.imageText
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => value && value !== url);
    setEditor({ ...editor, imageText: next.join("\n") });
    if (managedMediaPublicId(url)) {
      setPendingDeleteUrls((current) =>
        current.includes(url) ? current : [...current, url]
      );
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || busy || mediaBusy || addingCategory) return;
    const input = toInput(editor);
    if (!input) {
      setError(t.invalid);
      return;
    }

    setBusy(true);
    setError(null);
    dismiss();
    try {
      if (editor.id) {
        const saved = await updateProduct(client, store.id, editor.id, input);
        cacheProduct(saved);
        for (const url of pendingDeleteUrls) {
          const publicId = managedMediaPublicId(url);
          if (!publicId) continue;
          try {
            await deleteMediaByPublicId(client, store.id, publicId);
          } catch {
            // The orphan cleanup path handles storage records left behind.
          }
        }
        setEditor(null);
        draft.discard();
        setPendingDeleteUrls([]);
        await refreshAfterMutation(t.saved);
      } else {
        const created = await createProduct(client, store.id, input);
        cacheProduct(created);
        setEditor(editorFromProduct(created));
        setSlugTouched(true);
        setPendingDeleteUrls([]);
        await refreshAfterMutation(t.createdAddImages);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "PRODUCT_SLUG_TAKEN") {
        setError(t.slugTaken);
      } else {
        setError(t.genericError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeVisibility(product: Product) {
    if (busy || mediaBusy || product.status === "archived" || editor?.id === product.id) return;
    const status = product.status === "active" ? "draft" : "active";
    setBusy(true);
    setVisibilityBusy(product.id);
    setError(null);
    dismiss();
    try {
      cacheProduct(await setProductStatus(client, store.id, product.id, status));
      await refreshAfterMutation(status === "draft" ? t.hidden : t.activated + (store.status === "published" ? "" : " " + t.publishFirst));
    } catch {
      setError(t.genericError);
    } finally {
      setVisibilityBusy(null);
      setBusy(false);
    }
  }

  async function duplicate(product: Product) {
    setBusy(true);
    setError(null);
    dismiss();
    try {
      cacheProduct(await duplicateProduct(client, store.id, product.id));
      await refreshAfterMutation(t.duplicated);
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(t.archiveConfirm)) return;
    setBusy(true);
    setError(null);
    dismiss();
    try {
      await archiveProduct(client, store.id, product.id);
      cacheProduct({ ...product, status: "archived" });
      if (editor?.id === product.id) {setEditor(null);draft.discard();}
      await refreshAfterMutation(t.archivedDone);
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function move(product: Product, direction: -1 | 1) {
    const movable = ordered.filter((item) => item.status !== "archived");
    const current = movable.findIndex((item) => item.id === product.id);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= movable.length) return;

    const reordered = [...movable];
    const [selected] = reordered.splice(current, 1);
    reordered.splice(target, 0, selected);

    setBusy(true);
    setError(null);
    dismiss();
    try {
      for (let index = 0; index < reordered.length; index += 1) {
        const item = reordered[index];
        const sortOrder = (index + 1) * 10;
        if (item.sortOrder !== sortOrder) {
          cacheProduct(await updateProduct(
            client,
            store.id,
            item.id,
            productToInput(item, sortOrder)
          ));
        }
      }
      await refreshAfterMutation(t.reordered);
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="catalog-panel" aria-labelledby="catalog-title">
      <div className="catalog-heading workspace-page-heading">
        <div>
          <h1 id="catalog-title">{t.title}</h1>
          <p>{t.body}</p>
        </div>
        <button
          type="button"
          className={editor ? "admin-secondary" : "admin-primary"}
          onClick={startCreate}
          disabled={busy || mediaBusy}
        >
          <AppIcon name="plus" />{t.add}
        </button>
      </div>

      <MerchantNotice notice={notice} language={language} onDismiss={dismiss} />
      {editor ? <p className="draft-note" role="status">{language === "fr" ? "Brouillon conservé dans cet onglet. Enregistrez pour appliquer vos modifications." : "Draft kept in this tab. Save to apply changes."}</p> : null}
      {error ? <p className="form-message error">{error}</p> : null}

      {editor ? (
        <form className="catalog-editor" onSubmit={save}>
          <div className="workspace-form-heading"><h2>{editor.id ? (language === "fr" ? "Modifier le produit" : "Edit product") : (language === "fr" ? "Nouveau produit" : "New product")}</h2><p>{language === "fr" ? "Renseignez les informations du produit, puis enregistrez." : "Enter product details, then save."}</p></div>
          <fieldset className="admin-form admin-form-grid catalog-fields" disabled={busy || mediaBusy} aria-label={language === "fr" ? "Informations du produit" : "Product details"}>
            <label className="span-2">
              <span>{t.name}</span>
              <input
                ref={nameRef}
                aria-label={t.name}
                value={editor.name}
                maxLength={180}
                onChange={(event) => {
                  const name = event.target.value;
                  setEditor({
                    ...editor,
                    name,
                    slug: slugTouched ? editor.slug : slugify(name)
                  });
                }}
                required
              />
            </label>

            <label className="span-2">
              <span>{t.slug}</span>
              <div className="slug-field">
                <small>{store.slug}/</small>
                <input
                  aria-label={t.slug}
                  value={editor.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setEditor({
                      ...editor,
                      slug: slugify(event.target.value)
                    });
                  }}
                  required
                />
              </div>
            </label>

            <label>
              <span>{t.price}</span>
              <div className="catalog-price-field">
                <input
                  inputMode="decimal"
                  aria-label={t.price}
                  value={editor.price}
                  onChange={(event) =>
                    setEditor({ ...editor, price: event.target.value })
                  }
                  placeholder="15000"
                  required
                />
                <b>{editor.currencyCode}</b>
              </div>
            </label>

            <label>
              <span>{t.status}</span>
              <select
                aria-label={t.status}
                value={editor.status}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    status: event.target.value as "draft" | "active"
                  })
                }
              >
                <option value="draft">{t.draft}</option>
                <option value="active">{t.active}</option>
              </select>
            </label>

            <div className="catalog-category-control">
              <label><span>{t.category}</span>
              <select
                ref={categorySelectRef}
                aria-label={t.category}
                value={editor.category}
                onChange={event => {
                  if (event.target.value === categories.addValue) setAddingCategory(true);
                  else { setEditor({ ...editor, category: event.target.value }); resetCategoryEntry(); }
                }}
              >
                <option value="">{t.noCategory}</option>
                {categories.existing.length ? <optgroup label={t.existingCategories}>{categories.existing.map(value => <option key={value} value={value}>{value}</option>)}</optgroup> : null}
                {categories.proposed.length ? <optgroup label={t.suggestedCategories}>{categories.proposed.map(value => <option key={value} value={value}>{value}</option>)}</optgroup> : null}
                <option value={categories.addValue}>{t.addCategory}</option>
              </select></label>
              {addingCategory ? <div className="catalog-category-entry">
                <label><span>{t.categoryName}</span><input
                  ref={categoryNameRef}
                  value={categoryName}
                  maxLength={80}
                  required
                  aria-describedby={categoryHelpId}
                  onChange={event => { event.target.setCustomValidity(""); setCategoryName(event.target.value); }}
                  onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addCategory(); } }}
                /></label>
                <small id={categoryHelpId}>{t.categoryHint}</small>
                <div className="catalog-category-actions"><button type="button" className="admin-secondary" onClick={addCategory}>{t.useCategory}</button><button type="button" className="admin-secondary" onClick={() => resetCategoryEntry(true)}>{t.cancel}</button></div>
              </div> : null}
            </div>

            <label>
              <span>{t.stock}</span>
              <select
                aria-label={t.stock}
                value={editor.stockLabel}
                onChange={(event) =>
                  setEditor({ ...editor, stockLabel: event.target.value })
                }
              >
                <option value="">{t.stockDefault}</option>
                {stocks.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="span-2">
              <span>{t.description}</span>
              <textarea
                rows={4}
                maxLength={2000}
                aria-label={t.description}
                value={editor.description}
                onChange={(event) =>
                  setEditor({ ...editor, description: event.target.value })
                }
              />
            </label>

            <div className="span-2 catalog-media-field">
              <span>{t.images}</span>
              <div className="catalog-media-grid">
                {editor.imageText
                  .split(/\r?\n/)
                  .map((url) => url.trim())
                  .filter(Boolean)
                  .map((url) => (
                    <div className="catalog-media-item" key={url}>
                      <MerchantImage client={client} storeId={store.id} url={url} language={language} />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        disabled={busy || mediaBusy}
                      >
                        {t.removeImage}
                      </button>
                    </div>
                  ))}
              </div>
              <label className="catalog-upload-control">
                <span>{mediaBusy ? t.uploading : t.uploadImages}</span>
                <input
                  type="file"
                  aria-label={t.uploadImages}
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={!editor.id || busy || mediaBusy}
                  onChange={(event) => {
                    void uploadImages(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <small>{!editor.id ? (language === "fr" ? "Créez le produit pour activer l’ajout des images. " : "Create the product to enable image uploads. ") : ""}{t.imagesHint}</small>
            </div>

            <label className="span-2">
              <span>{t.variants}</span>
              <textarea
                rows={3}
                aria-label={t.variants}
                value={editor.variantText}
                onChange={(event) =>
                  setEditor({ ...editor, variantText: event.target.value })
                }
                placeholder={language === "fr" ? "Couleur: Noir\nTaille: M" : "Color: Black\nSize: M"}
              />
              <small>{t.variantsHint}</small>
            </label>
          </fieldset>

          <div className="catalog-editor-actions">
            <button
              type="button"
              className="admin-secondary"
              onClick={() => {
                if(!window.confirm(language === "fr" ? "Abandonner ce brouillon ?" : "Discard this draft?"))return;
                setEditor(null);
        draft.discard();
                setPendingDeleteUrls([]);
              }}
              disabled={busy || mediaBusy}
            >
              {t.cancel}
            </button>
            <button className="admin-primary" type="submit" disabled={busy || mediaBusy || addingCategory}>
              {editor.id ? t.save : t.create}
            </button>
          </div>
        </form>
      ) : null}

      {ordered.length > 0 && <div className="catalog-toolbar"><label className="workspace-search-field"><span>{language === "fr" ? "Rechercher un produit" : "Find a product"}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={language === "fr" ? "Nom, catégorie ou adresse…" : "Name, category or address…"} /></label><label className="workspace-filter"><span>{language === "fr" ? "Statut du produit" : "Product status"}</span><select aria-label={language === "fr" ? "Statut du produit" : "Product status"} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">{language === "fr" ? "Tous les statuts" : "All statuses"}</option><option value="active">{t.active}</option><option value="draft">{t.draft}</option><option value="archived">{t.archived}</option></select></label><span className="catalog-result-count" role="status">{loading ? "…" : visibleProducts.length} {language === "fr" ? "produit(s)" : "product(s)"}</span></div>}
      {loading ? (
        <div className="catalog-state">
          <span className="admin-loader" />
          <p>{t.loading}</p>
        </div>
      ) : ordered.length === 0 ? (
        !editor && <div className="catalog-state">
          <strong>{t.emptyTitle}</strong>
          <p>{t.emptyBody}</p>
        </div>
      ) : visibleProducts.length === 0 ? <div className="catalog-state"><strong>{language === "fr" ? "Aucun produit ne correspond" : "No matching products"}</strong><button type="button" className="admin-secondary" onClick={() => { setQuery(""); setStatusFilter("all"); }}>{language === "fr" ? "Effacer les filtres" : "Clear filters"}</button></div> : (
        <div className="catalog-list">
          {visibleProducts.map((product) => {
            const activeIndex = ordered
              .filter((item) => item.status !== "archived")
              .findIndex((item) => item.id === product.id);
            const activeCount = ordered.filter(
              (item) => item.status !== "archived"
            ).length;
            return (
              <article
                key={product.id}
                className={
                  "catalog-card" +
                  (product.status === "archived" ? " archived" : "")
                }
              >
                <div className="catalog-thumb">
                  {product.imageUrls[0] ? (
                    <MerchantImage client={client} storeId={store.id} url={product.imageUrls[0]} language={language} />
                  ) : (
                    <span>{t.imagePending}</span>
                  )}
                </div>

                <div className="catalog-card-copy">
                  <div className="catalog-card-title">
                    <div>
                      <strong>{product.name}</strong>
                      <small>/{product.slug}</small>
                    </div>
                    <span className={"catalog-status " + product.status}>
                      {product.status === "active"
                        ? t.active
                        : product.status === "archived"
                          ? t.archived
                          : t.draft}
                    </span>
                  </div>

                  <b className="catalog-price">
                    {formatMoney(product.price, product.currencyCode, language)}
                  </b>
                  <p>
                    {product.category || "—"} · {product.stockLabel || t.stockDefault}
                    {product.variants.length
                      ? " · " + product.variants.length + " " + t.variantsLabel
                      : ""}
                  </p>
                  {product.status === "archived" ? (
                    <small className="catalog-archived-note">{t.archivedHint}</small>
                  ) : <small className="catalog-visibility-hint">
                    {editor?.id === product.id ? t.closeEditorForStatus : product.status === "active" ? (store.status === "published" ? t.visible : t.notPublished) : t.notVisible}
                    {product.status === "active" && store.status === "published" && <a href={"/store/" + encodeURIComponent(store.slug) + "/p/" + encodeURIComponent(product.slug)} target="_blank" rel="noreferrer">{t.viewProduct} ↗</a>}
                  </small>}
                </div>

                <div className="catalog-actions">
                  {product.status !== "archived" && <button
                    type="button"
                    className={"catalog-visibility-action" + (product.status === "draft" ? " activate" : "")}
                    aria-label={(product.status === "active" ? t.hide : t.activate) + " · " + product.name}
                    aria-busy={visibilityBusy === product.id}
                    onClick={() => changeVisibility(product)}
                    disabled={busy || mediaBusy || editor?.id === product.id}
                  >{visibilityBusy === product.id ? t.changingVisibility : product.status === "active" ? t.hide : t.activate}</button>}
                  <div className="catalog-order-actions">
                    <button
                      type="button"
                      aria-label={t.moveUp}
                      onClick={() => move(product, -1)}
                      disabled={busy || mediaBusy || product.status === "archived" || activeIndex <= 0 || Boolean(normalizedQuery) || statusFilter !== "all"}
                    >↑</button>
                    <button
                      type="button"
                      aria-label={t.moveDown}
                      onClick={() => move(product, 1)}
                      disabled={
                        busy || mediaBusy ||
                        product.status === "archived" ||
                        activeIndex < 0 ||
                        activeIndex >= activeCount - 1
                        || Boolean(normalizedQuery) || statusFilter !== "all"
                      }
                    >↓</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(product)}
                    disabled={busy || mediaBusy || product.status === "archived"}
                  >
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicate(product)}
                    disabled={busy || mediaBusy || product.status === "archived"}
                  >
                    {t.duplicate}
                  </button>
                  <button
                    type="button"
                    className="catalog-danger"
                    onClick={() => archive(product)}
                    disabled={busy || mediaBusy || product.status === "archived"}
                  >
                    {t.archive}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

