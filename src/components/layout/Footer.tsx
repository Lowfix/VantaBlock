import { Link } from "react-router-dom";
import { Send, MessageCircle, Code2 } from "lucide-react";
import { Logo } from "./Logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Server Locations", href: "/#" },
      { label: "Status Page", href: "/#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#" },
      { label: "Careers", href: "/#" },
      { label: "Blog", href: "/#" },
      { label: "Contact", href: "/#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Knowledge Base", href: "/#" },
      { label: "Modpack Guides", href: "/#" },
      { label: "API Docs", href: "/#" },
      { label: "Affiliate Program", href: "/#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/#" },
      { label: "Privacy Policy", href: "/#" },
      { label: "Refund Policy", href: "/#" },
      { label: "Acceptable Use", href: "/#" },
    ],
  },
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
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
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
          <p className="text-xs text-text-lo">© 2026 Vantablock Hosting LLC. All rights reserved.</p>
          <p className="text-xs text-text-lo">Not affiliated with Mojang Studios or Microsoft.</p>
        </div>
      </div>
    </footer>
  );
}
