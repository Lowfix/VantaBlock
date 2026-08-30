import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { GetStartedPage } from "./pages/GetStartedPage";
import { LocationsPage } from "./pages/LocationsPage";

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
