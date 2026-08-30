import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { GetStartedPage } from "./pages/GetStartedPage";
import { LocationsPage } from "./pages/LocationsPage";
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
