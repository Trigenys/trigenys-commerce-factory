import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// The public landing must not download merchant-admin, storefront or
// personalized-demo code before the visitor chooses one of those routes.
const AdminApp = lazy(() => import("./admin/AdminApp"));
const StorefrontApp = lazy(() => import("./storefront/StorefrontApp"));
const DemoStorefrontApp = lazy(() => import("./demo/DemoStorefrontApp"));
const ThemeGalleryApp = lazy(() => import("./themes/ThemeGalleryApp"));

const pathname = window.location.pathname;
const isMerchantApp = pathname === "/app" || pathname.startsWith("/app/");
const isStorefront = pathname.startsWith("/store/");
const isDemoStorefront = pathname.startsWith("/demo/");
const isThemeGallery = pathname === "/themes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isMerchantApp || isStorefront || isDemoStorefront || isThemeGallery ? (
      <Suspense fallback={<main role="status" aria-live="polite" style={{ padding: "2rem", minHeight: "40vh" }}>Chargement…</main>}>
        {isMerchantApp ? (
          <AdminApp />
        ) : isStorefront ? (
          <StorefrontApp />
        ) : isThemeGallery ? (
          <ThemeGalleryApp />
        ) : (
          <DemoStorefrontApp />
        )}
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
);
