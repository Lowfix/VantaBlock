import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { GetStartedPage } from "./pages/GetStartedPage";
import { LocationsPage } from "./pages/LocationsPage";
// The whole panel demo (recovered panel UI + its in-memory backend) is
// lazy-loaded so visitors who never open it don't download it — it's a
// separate chunk (~200KB) behind these five dynamic imports.
const PanelDemoScope = lazy(() => import("./demo/PanelDemoScope").then((m) => ({ default: m.PanelDemoScope })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ServerPanelPage = lazy(() => import("./pages/ServerPanelPage").then((m) => ({ default: m.ServerPanelPage })));
const BillingPage = lazy(() => import("./pages/BillingPage").then((m) => ({ default: m.BillingPage })));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage").then((m) => ({ default: m.AccountSettingsPage })));
const SupportPage = lazy(() => import("./pages/SupportPage").then((m) => ({ default: m.SupportPage })));

const panelFallback = (
  <div className="flex min-h-screen items-center justify-center bg-void">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
  </div>
);
import { LegalPage } from "./pages/LegalPage";
import { LEGAL_PAGES_ENABLED } from "./config";

// A plain <BrowserRouter> leaves the scroll position alone on client-side
// navigation and doesn't jump to `#hash` targets either (that's a
// full-page-load behavior; pushState skips it). So: with a hash, scroll to
// that element once the new page has rendered — that's what makes
// "/#pricing"-style links work from *other* pages, and same-page anchor links
// keep working too. Without one, start the new page at the top instead of
// wherever the previous page happened to be scrolled to.
function ScrollManager() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/get-started" element={<GetStartedPage />} />
        {/* The panel demo — the recovered real panel UI running on the
            in-memory demo backend (src/demo). One layout route provides the
            user/toast providers and the persistent "this is a demo" pill. */}
        <Route element={<Suspense fallback={panelFallback}><PanelDemoScope /></Suspense>}>
          <Route path="/panel-preview" element={<DashboardPage />} />
          <Route path="/panel-preview/servers/:serverId" element={<ServerPanelPage />} />
          <Route path="/panel-preview/billing" element={<BillingPage />} />
          <Route path="/panel-preview/support" element={<SupportPage />} />
          <Route path="/panel-preview/account" element={<AccountSettingsPage />} />
        </Route>
        {LEGAL_PAGES_ENABLED ? (
          <>
            {/* /legal alone and unknown slugs both redirect to the Terms inside LegalPage. */}
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/legal/:slug" element={<LegalPage />} />
          </>
        ) : (
          // Flag off (production, for now — see src/config.ts): the documents
          // exist in the bundle but nothing links to them and the URLs go home.
          <Route path="/legal/*" element={<Navigate to="/" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
