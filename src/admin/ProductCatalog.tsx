import { useDraft, useUnsavedChanges } from "../lib/drafts";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
    stock: "Indication de stock",
    description: "Description",
    status: "Visibilité",
    draft: "Brouillon",
    active: "Actif",
    archived: "Archivé",
    images: "Images",
    imagesHint: "JPEG, PNG ou WebP. Nous optimisons automatiquement en WebP, max 8 images.",
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
    invalid: "Vérifiez le nom, le prix, les images et les variantes.",
    slugTaken: "Cette adresse produit existe déjà dans votre boutique.",
    genericError: "Une erreur est survenue. Réessayez.",
    imagePending: "Aucune image",
    variantsLabel: "variantes",
    stockDefault: "Stock non précisé",
    archivedHint: "Ce produit reste dans l’historique mais n’est plus modifiable.",
    saved: "Produit enregistré."
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
    stock: "Stock label",
    description: "Description",
    status: "Visibility",
    draft: "Draft",
    active: "Active",
    archived: "Archived",
    images: "Images",
    imagesHint: "JPEG, PNG or WebP. We optimize automatically to WebP, maximum 8 images.",
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
    invalid: "Check the name, price, images and variants.",
    slugTaken: "That product address is already used in this store.",
    genericError: "Something went wrong. Try again.",
    imagePending: "No image",
    variantsLabel: "variants",
    stockDefault: "Stock not specified",
    archivedHint: "This product stays in history but can no longer be edited.",
    saved: "Product saved."
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [pendingDeleteUrls, setPendingDeleteUrls] = useState<string[]>([]);

  const ordered = useMemo(
    () => [...products].sort((a, b) => {
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      return a.sortOrder - b.sortOrder;
    }),
    [products]
  );

  async function reload() {
    const next = await listProducts(client, store.id);
    setProducts(next);
    onProductsChange?.(next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listProducts(client, store.id);
        if (!cancelled) { setProducts(next); onProductsChange?.(next); }
      } catch {
        if (!cancelled) setError(t.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, store.id, language, onProductsChange]);

  function startCreate() {
    if (editor && !window.confirm(language === "fr" ? "Remplacer le brouillon en cours ?" : "Replace the current draft?")) return;
    const maxOrder = products.reduce(
      (max, product) => Math.max(max, product.sortOrder),
      0
    );
    setEditor(blankEditor(store, maxOrder + 10));
    setSlugTouched(false);
    setError(null);
    setMessage(null);
    setPendingDeleteUrls([]);
  }

  function startEdit(product: Product) {
    if (editor && !window.confirm(language === "fr" ? "Remplacer le brouillon en cours ?" : "Replace the current draft?")) return;
    if (product.status === "archived") return;
    setEditor(editorFromProduct(product));
    setSlugTouched(true);
    setError(null);
    setMessage(null);
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
      }
      setEditor({ ...editor, imageText: next.join("\n") });
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
    if (!editor) return;
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
    if (!editor) return;
    const input = toInput(editor);
    if (!input) {
      setError(t.invalid);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (editor.id) {
        await updateProduct(client, store.id, editor.id, input);
        for (const url of pendingDeleteUrls) {
          const publicId = managedMediaPublicId(url);
          if (!publicId) continue;
          try {
            await deleteMediaByPublicId(client, store.id, publicId);
          } catch {
            // The orphan cleanup path handles storage records left behind.
          }
        }
        await reload();
        setEditor(null);
        draft.discard();
        setPendingDeleteUrls([]);
        setMessage(t.saved);
      } else {
        const created = await createProduct(client, store.id, input);
        await reload();
        setEditor(editorFromProduct(created));
        setSlugTouched(true);
        setPendingDeleteUrls([]);
        setMessage(t.createdAddImages);
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

  async function duplicate(product: Product) {
    setBusy(true);
    setError(null);
    try {
      await duplicateProduct(client, store.id, product.id);
      await reload();
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
    try {
      await archiveProduct(client, store.id, product.id);
      await reload();
      if (editor?.id === product.id) {setEditor(null);draft.discard();}
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
    try {
      for (let index = 0; index < reordered.length; index += 1) {
        const item = reordered[index];
        const sortOrder = (index + 1) * 10;
        if (item.sortOrder !== sortOrder) {
          await updateProduct(
            client,
            store.id,
            item.id,
            productToInput(item, sortOrder)
          );
        }
      }
      await reload();
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="catalog-panel" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <div>
          <span className="admin-eyebrow">{t.eyebrow}</span>
          <h2 id="catalog-title">{t.title}</h2>
          <p>{t.body}</p>
        </div>
        <button
          type="button"
          className="admin-primary"
          onClick={startCreate}
          disabled={busy}
        >
          + {t.add}
        </button>
      </div>

      {message ? <p role="status" className="form-message success">{message}</p> : null}
      {editor ? <p className="draft-note" role="status">{language === "fr" ? "Brouillon conservé dans cet onglet. Enregistrez pour appliquer vos modifications." : "Draft kept in this tab. Save to apply changes."}</p> : null}
      {error ? <p className="form-message error" role="alert">{error}</p> : null}

      {editor ? (
        <form className="catalog-editor" onSubmit={save}>
          <div className="admin-form admin-form-grid">
            <label className="span-2">
              <span>{t.name}</span>
              <input
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

            <label>
              <span>{t.category}</span>
              <input
                aria-label={t.category}
                value={editor.category}
                maxLength={80}
                onChange={(event) =>
                  setEditor({ ...editor, category: event.target.value })
                }
                placeholder="Audio"
              />
            </label>

            <label>
              <span>{t.stock}</span>
              <input
                aria-label={t.stock}
                value={editor.stockLabel}
                maxLength={80}
                onChange={(event) =>
                  setEditor({ ...editor, stockLabel: event.target.value })
                }
                placeholder={language === "fr" ? "En stock" : "In stock"}
              />
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
                      <img src={url} alt="" loading="lazy" />
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
          </div>

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
            <button className="admin-primary" type="submit" disabled={busy || mediaBusy}>
              {editor.id ? t.save : t.create}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="catalog-state">
          <span className="admin-loader" />
          <p>{t.loading}</p>
        </div>
      ) : ordered.length === 0 ? (
        <div className="catalog-state">
          <strong>{t.emptyTitle}</strong>
          <p>{t.emptyBody}</p>
          <button type="button" className="admin-primary" onClick={startCreate}>
            {t.add}
          </button>
        </div>
      ) : (
        <div className="catalog-list">
          {ordered.map((product, index) => {
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
                    <img src={product.imageUrls[0]} alt="" loading="lazy" />
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
                  ) : null}
                </div>

                <div className="catalog-actions">
                  <div className="catalog-order-actions">
                    <button
                      type="button"
                      aria-label={t.moveUp}
                      onClick={() => move(product, -1)}
                      disabled={busy || product.status === "archived" || activeIndex <= 0}
                    >↑</button>
                    <button
                      type="button"
                      aria-label={t.moveDown}
                      onClick={() => move(product, 1)}
                      disabled={
                        busy ||
                        product.status === "archived" ||
                        activeIndex < 0 ||
                        activeIndex >= activeCount - 1
                      }
                    >↓</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(product)}
                    disabled={busy || product.status === "archived"}
                  >
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicate(product)}
                    disabled={busy || product.status === "archived"}
                  >
                    {t.duplicate}
                  </button>
                  <button
                    type="button"
                    className="catalog-danger"
                    onClick={() => archive(product)}
                    disabled={busy || product.status === "archived"}
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
