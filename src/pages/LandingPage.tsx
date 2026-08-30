import { AmbientPage } from "../components/layout/AmbientPage";
import { PublicNavbar } from "../components/layout/PublicNavbar";
import { Footer } from "../components/layout/Footer";
import { Hero } from "../components/landing/Hero";
import { Features } from "../components/landing/Features";
import { LocationsTeaser } from "../components/landing/LocationsTeaser";
import { FAQ } from "../components/landing/FAQ";
import { FriendsPhaseNotice } from "../components/landing/FriendsPhaseNotice";
import { CTASection } from "../components/landing/CTASection";

export function LandingPage() {
  // The fixed, parallax-scrolling decorative background (and the three
  // already-solved CSS bugs behind its structure) lives in AmbientPage now,
  // shared with LocationsPage — read its comment block before touching it.
  return (
    <AmbientPage>
      <PublicNavbar />
      <Hero />
      <Features />
      <LocationsTeaser />
      <FriendsPhaseNotice />
      <FAQ />
      <CTASection />
      <Footer />
    </AmbientPage>
  );
}
