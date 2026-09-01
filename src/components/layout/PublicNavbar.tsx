import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { buttonVariants } from "../ui/Button";

// Every href is root-relative ("/#features", not "#features") so the same
// navbar works from /locations and /get-started too — App.tsx's
// ScrollManager handles scrolling to the hash after a client-side navigation.
const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Locations", href: "/locations" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Panel", href: "/panel-preview" },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-void/80 backdrop-blur-lg">
      {/* Private-beta strip: makes the mode unmistakable before anything else
          on the page does. Sits inside the sticky header so it never scrolls
          out of view. */}
      <p className="border-b border-accent-500/20 bg-accent-500/10 px-4 py-1.5 text-center text-[12px] font-medium text-accent-300">
        Private beta · Invite required · No charge during testing
      </p>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" aria-label="Vantablock home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link key={link.label} to={link.href} className="text-[13.5px] font-medium text-text-md transition-colors hover:text-text-hi">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/get-started" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Use an invite
          </Link>
        </div>

        <button
          className="p-2 text-text-md md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line-soft px-6 py-4 md:hidden animate-fade-in-up">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-text-md hover:text-text-hi"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link to="/get-started" onClick={() => setOpen(false)} className={buttonVariants({ variant: "primary", className: "w-full" })}>
                Get started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
