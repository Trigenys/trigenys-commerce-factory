import AppErrorBoundary from "./components/AppErrorBoundary";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { merchantAppHref } from "./merchant-navigation";
import "./styles.css";
import "./brand/brand.css";

// Each route downloads its own content and styles. Help, the showroom and
// the merchant workspace do not need the landing's animated illustrations.
const App = lazy(() => import("./App"));
const ThemeGalleryApp = lazy(() => import("./themes/ThemeGalleryApp"));
const PublicPages = lazy(() => import("./pages/PublicPages"));
const OrderTrackingPage = lazy(() => import("./storefront/OrderTrackingPage"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
const StorefrontApp = lazy(() => import("./storefront/StorefrontApp"));
const DemoStorefrontApp = lazy(() => import("./demo/DemoStorefrontApp"));

const pathname = window.location.pathname;
const isMerchantApp = pathname === "/app" || pathname.startsWith("/app/");
const isStorefront = pathname.startsWith("/store/");
const isOrderTracking = /^\/orders\/[^/]+$/.test(pathname);
const isDemoStorefront = pathname.startsWith("/demo/");
const isThemeGallery = pathname === "/themes" || pathname.startsWith("/themes/");

const isInfoPage = ["/help","/contact","/privacy","/terms"].includes(pathname) || pathname.startsWith("/help/requests/");
const isUnknownPage = pathname !== "/" && !isMerchantApp && !isStorefront && !isDemoStorefront && !isThemeGallery && !isInfoPage && !isOrderTracking;

const merchantHref = merchantAppHref();
if (isMerchantApp && merchantHref !== "/app") {
  window.location.replace(merchantHref + pathname.slice(4) + window.location.search + window.location.hash);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppErrorBoundary>
      <Suspense fallback={<main role="status" aria-live="polite" style={{ padding: "2rem", minHeight: "40vh" }}>Chargement…</main>}>
      {isMerchantApp || isStorefront || isDemoStorefront || isThemeGallery || isInfoPage || isUnknownPage || isOrderTracking ? (
        <>
          {isOrderTracking ? <OrderTrackingPage /> : isInfoPage || isUnknownPage ? (
            <PublicPages />
          ) : isMerchantApp ? (
            <AdminApp />
          ) : isStorefront ? (
            <StorefrontApp />
          ) : isThemeGallery ? (
            <ThemeGalleryApp />
          ) : (
            <DemoStorefrontApp />
          )}
        </>
      ) : (
        <App />
      )}
      </Suspense>
      </AppErrorBoundary>
    </StrictMode>
  );
}
