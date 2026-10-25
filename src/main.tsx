import AppErrorBoundary from "./components/AppErrorBoundary";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ThemeGalleryApp from "./themes/ThemeGalleryApp";
import { merchantAppHref } from "./merchant-navigation";
import "./styles.css";
import "./brand/brand.css";

// The landing and theme-library introduction paint with the entry bundle.
// Merchant and storefront features are downloaded on their own routes.
const PublicPages = lazy(() => import("./pages/PublicPages"));
const OrderTrackingPage = lazy(() => import("./storefront/OrderTrackingPage"));
const AdminApp = lazy(() => import("./admin/AdminApp"));
const StorefrontApp = lazy(() => import("./storefront/StorefrontApp"));
const DemoStorefrontApp = lazy(() => import("./demo/DemoStorefrontApp"));
const CinematicProductStory = lazy(() => import("./labs/CinematicProductStory"));

const pathname = window.location.pathname;
const isMerchantApp = pathname === "/app" || pathname.startsWith("/app/");
const isStorefront = pathname.startsWith("/store/");
const isOrderTracking = /^\/orders\/[^/]+$/.test(pathname);
const isDemoStorefront = pathname.startsWith("/demo/");
const isThemeGallery = pathname === "/themes" || pathname.startsWith("/themes/");
const isCinematicLab = pathname === "/labs/cinematic-product-story";

const isInfoPage = ["/help","/contact","/privacy","/terms"].includes(pathname) || pathname.startsWith("/help/requests/");
const isUnknownPage = pathname !== "/" && !isMerchantApp && !isStorefront && !isDemoStorefront && !isThemeGallery && !isCinematicLab && !isInfoPage && !isOrderTracking;

const merchantHref = merchantAppHref();
if (isMerchantApp && merchantHref !== "/app") {
  window.location.replace(merchantHref + pathname.slice(4) + window.location.search + window.location.hash);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppErrorBoundary>
      {isMerchantApp || isStorefront || isDemoStorefront || isThemeGallery || isCinematicLab || isInfoPage || isUnknownPage || isOrderTracking ? (
        <Suspense fallback={<main role="status" aria-live="polite" style={{ padding: "2rem", minHeight: "40vh" }}>Chargement…</main>}>
          {isOrderTracking ? <OrderTrackingPage /> : isInfoPage || isUnknownPage ? (
            <PublicPages />
          ) : isMerchantApp ? (
            <AdminApp />
          ) : isStorefront ? (
            <StorefrontApp />
          ) : isThemeGallery ? (
            <ThemeGalleryApp />
          ) : isCinematicLab ? (
            <CinematicProductStory />
          ) : (
            <DemoStorefrontApp />
          )}
        </Suspense>
      ) : (
        <App />
      )}
      </AppErrorBoundary>
    </StrictMode>
  );
}
