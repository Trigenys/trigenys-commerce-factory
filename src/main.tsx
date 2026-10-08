import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./admin/AdminApp";
import "./styles.css";

const path = window.location.pathname;
const isMerchantApp = path === "/app" || path.startsWith("/app/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isMerchantApp ? <AdminApp /> : <App />}
  </StrictMode>
);
