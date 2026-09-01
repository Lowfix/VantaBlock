import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Inbox,
  Users,
  Server,
  Cpu,
  SlidersHorizontal,
  History,
  LifeBuoy,
  CreditCard,
} from "lucide-react";
import { Logo } from "./Logo";
import { useUser } from "../../context/UserContext";
import { Avatar } from "../ui/Avatar";
import { Menu as DropdownMenu, MenuItem, MenuSeparator } from "../ui/Menu";
import { cn } from "../../lib/cn";

const baseNavItems = [
  { label: "Overview", href: "/panel-preview", icon: LayoutDashboard },
  { label: "Billing & Plans", href: "/panel-preview/billing", icon: CreditCard },
  { label: "Support", href: "/panel-preview/support", icon: LifeBuoy },
  { label: "Account Settings", href: "/panel-preview/account", icon: Settings },
];

const adminNavItems = [{ label: "Creation Requests", href: "/requests", icon: Inbox }];

// The owner gets a completely separate nav — a business console, not the
// customer dashboard with a few extra items appended to it.
const ownerConsoleNavItems = [
  { label: "Overview", href: "/panel-preview", icon: LayoutDashboard },
  { label: "Servers", href: "/owner/servers", icon: Server },
  { label: "Accounts", href: "/accounts", icon: Users },
  { label: "Billing", href: "/owner/billing", icon: CreditCard },
  { label: "Activity", href: "/owner/activity", icon: History },
  { label: "Infrastructure", href: "/owner/infrastructure", icon: Cpu },
  { label: "Support", href: "/owner/support", icon: LifeBuoy },
  { label: "Settings", href: "/owner/settings", icon: SlidersHorizontal },
];

export function DashboardShell({ children, title }: { children: ReactNode; title: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  if (!currentUser) return null;

  const navItems = currentUser.isOwner
    ? ownerConsoleNavItems
    : [...baseNavItems, ...(currentUser.isAdmin ? adminNavItems : [])];

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link to="/panel-preview">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-accent-500/10 text-accent-300 shadow-[0_0_0_1px_rgba(130,87,255,0.2)_inset]"
                  : "text-text-md hover:bg-panel-2 hover:text-text-hi"
              )}
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line-soft p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-text-lo transition-colors hover:bg-panel-2 hover:text-bad"
        >
          <LogOut size={17} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-void">
      <div className="hidden w-64 shrink-0 border-r border-line-soft bg-ink lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
        {SidebarContent}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-ink shadow-glow-md animate-fade-in-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 p-1 text-text-lo hover:text-text-hi"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line-soft bg-void/80 px-6 backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <button className="p-1 text-text-md lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <h1 className="text-[15px] font-semibold tracking-tight text-text-hi">{title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu
              trigger={
                <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-panel-2">
                  <Avatar initials={currentUser.avatarInitials} src={currentUser.avatarUrl} className="h-8 w-8 text-[12px]" />
                  <ChevronDown size={14} className="hidden text-text-lo sm:block" />
                </button>
              }
            >
              <div className="px-3.5 py-2.5 border-b border-line-soft">
                <p className="text-[13px] font-medium text-text-hi">
                  {currentUser.firstName} {currentUser.lastName}
                </p>
                <p className="text-xs text-text-lo">{currentUser.email}</p>
              </div>
              <Link to="/panel-preview/account">
                <MenuItem icon={<Settings size={14} />}>Account settings</MenuItem>
              </Link>
              <MenuSeparator />
              <MenuItem danger icon={<LogOut size={14} />} onClick={handleLogout}>
                Log out
              </MenuItem>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
