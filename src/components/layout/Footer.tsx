import { Link } from "react-router-dom";
import { Send, MessageCircle, Code2 } from "lucide-react";
import { Logo } from "./Logo";
import { LEGAL_DOCS } from "../../legal";
import { LEGAL_PAGES_ENABLED } from "../../config";

// Trimmed on 2026-08-29 to just Product + Legal: the Company column (About/
// Careers/Blog/Contact), the Resources column (Knowledge Base/Modpack Guides/
// API Docs/Affiliate Program) and Product's "Status Page" were all dropped
// until there's something real behind them — don't re-add placeholders for
// them. The Legal column is generated from src/legal's LEGAL_DOCS, so adding
// or renaming a policy there updates the footer automatically — and it's
// hidden entirely while LEGAL_PAGES_ENABLED is off (see src/config.ts).
const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Server Locations", href: "/locations" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  ...(LEGAL_PAGES_ENABLED
    ? [
        {
          title: "Legal",
          links: LEGAL_DOCS.map((d) => ({ label: d.title, href: `/legal/${d.slug}` })),
        },
      ]
    : []),
];

export function Footer() {
  return (
    // `relative` isn't for layout here — it's what makes this opaque
    // section correctly paint above the landing page's fixed-position
    // decorative background layer. A `position: fixed`/`absolute` element
    // paints above *any* non-positioned element regardless of DOM order,
    // so without this, the decoration behind it would show through despite
    // Footer's own `bg-ink` and coming later in the page.
    <footer className="relative border-t border-line-soft bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-text-lo">
              Dedicated Minecraft server hosting on AMD Ryzen 9 9955HX and DDR5 memory. Built for communities
              that don't tolerate lag.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a href="/#" className="rounded-lg border border-line p-2 text-text-lo transition-colors hover:border-accent-500/40 hover:text-text-hi">
                <Send size={16} />
              </a>
              <a href="/#" className="rounded-lg border border-line p-2 text-text-lo transition-colors hover:border-accent-500/40 hover:text-text-hi">
                <MessageCircle size={16} />
              </a>
              <a href="/#" className="rounded-lg border border-line p-2 text-text-lo transition-colors hover:border-accent-500/40 hover:text-text-hi">
                <Code2 size={16} />
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[13px] font-semibold text-text-hi">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {/* Router links so they work from any page without a full
                        reload (and land on the right #section via App.tsx's
                        ScrollManager). */}
                    <Link to={link.href} className="text-[13px] text-text-lo transition-colors hover:text-text-md">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line-soft pt-8 sm:flex-row">
          <p className="text-xs text-text-lo">© 2026 Vantablock. All rights reserved.</p>
          <p className="text-xs text-text-lo">Not affiliated with Mojang Studios or Microsoft.</p>
        </div>
      </div>
    </footer>
  );
}
