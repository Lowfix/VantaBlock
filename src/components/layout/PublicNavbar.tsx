import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { buttonVariants } from "../ui/Button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-void/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#">
          <Logo />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-[13.5px] font-medium text-text-md transition-colors hover:text-text-hi">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a href="#pricing" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Get started
          </a>
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
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-text-md hover:text-text-hi"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <a href="#pricing" className={buttonVariants({ variant: "primary", className: "w-full" })}>
                Get started
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
