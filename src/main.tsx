import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./admin/AdminApp";
import StorefrontApp from "./storefront/StorefrontApp";
import "./styles.css";

const path = window.location.pathname;
const isMerchantApp = path === "/app" || path.startsWith("/app/");
const isStorefront = path.startsWith("/store/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isMerchantApp ? (
      <AdminApp />
    ) : isStorefront ? (
      <StorefrontApp />
    ) : (
      <App />
    )}
  </StrictMode>
);
