import { useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Bell, Bot, Briefcase, Building2, FileText, Globe2, Inbox, LayoutDashboard, LineChart, Menu, PanelLeftClose, PanelLeftOpen, Phone, Plug, Search, Settings, Users, UserCog, Layers, LogOut } from "lucide-react";
import { useStore, session, actions } from "./lib/store";
import { ROLE_LABEL } from "./lib/types";
import { canSeeClients, canSeeCrm, canSeeVerticals, can, visibleCampaigns } from "./lib/rbac";
import { Logo } from "./components/Logo";
import { Avatar, Badge, cx } from "./components/ui";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Verticals from "./pages/Verticals";
import Clients from "./pages/Clients";
import { CampaignList, CampaignDetail } from "./pages/Campaigns";
import Crm from "./pages/Crm";
import InboxPage from "./pages/InboxPage";
import Calling from "./pages/Calling";
import Social from "./pages/Social";
import Integrations from "./pages/Integrations";
import Assistant from "./pages/Assistant";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Team from "./pages/Team";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const { db, me } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);

  const items = useMemo(() => {
    if (!me) return [];
    const all = [
      { to: "/", label: "Overview", icon: LayoutDashboard, show: true },
      { to: "/verticals", label: "Business Verticals", icon: Layers, show: canSeeVerticals(me) },
      { to: "/campaigns", label: "Campaigns", icon: Briefcase, show: true },
      { to: "/clients", label: "Client Management", icon: Building2, show: canSeeClients(me) },
      { to: "/crm", label: "CRM & Contacts", icon: Users, show: canSeeCrm(me) },
      { to: "/inbox", label: "Unified Inbox", icon: Inbox, show: can(me, "inbox.use") },
      { to: "/calling", label: "Calling Center", icon: Phone, show: can(me, "call.place") },
      { to: "/social", label: "Social Media", icon: Globe2, show: canSeeCrm(me) },
      { to: "/integrations", label: "Integrations", icon: Plug, show: canSeeCrm(me) },
      { to: "/ai", label: "AI Assistant", icon: Bot, show: can(me, "ai.use") },
      { to: "/reports", label: "Reports & Analytics", icon: LineChart, show: can(me, "report.run") },
      { to: "/documents", label: "Documents", icon: FileText, show: true },
      { to: "/team", label: "Team Management", icon: UserCog, show: can(me, "member.manage") || can(me, "audit.read") },
      { to: "/settings", label: "Settings & Security", icon: Settings, show: true },
    ];
    return all.filter((i) => i.show);
  }, [me]);

  if (!db.org || !me) return <Login />;

  const unread = db.notifications.filter((n) => !n.read && (!n.userId || n.userId === me.id));
  const results = q.trim().length > 1 ? search(db, me, q.trim().toLowerCase()) : [];

  return (
    <div className="flex h-full">
      {open && <div className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx("fixed z-40 flex h-full flex-col bg-navy-950 text-white transition-all lg:static", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0", collapsed ? "w-[72px]" : "w-64")} aria-label="Primary">
        <div className={cx("flex items-center px-4 py-5", collapsed && "justify-center px-2")}>{collapsed ? <Logo light size={34} /> : <Logo light />}</div>
        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === "/"} onClick={() => setOpen(false)} title={i.label}
              className={({ isActive }) => cx("focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", collapsed && "justify-center", isActive ? "bg-white/12 font-medium text-white shadow-[inset_3px_0_0_#f28c28]" : "text-white/70 hover:bg-white/8 hover:text-white")}>
              <i.icon size={18} className="shrink-0" />{!collapsed && <span className="truncate">{i.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => setCollapsed((c) => !c)} className="focus-ring m-3 hidden items-center justify-center gap-2 rounded-xl py-2 text-xs text-white/60 hover:bg-white/8 lg:flex" aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /> Collapse</>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur">
          <button className="focus-ring rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="relative max-w-md flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Global search" placeholder="Search leads, campaigns, clients…" className="focus-ring w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 text-sm" />
            {results.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl">
                {results.map((r) => <li key={r.key}><button className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => { nav(r.to); setQ(""); }}><span className="truncate">{r.label}</span><Badge tone={r.tone}>{r.kind}</Badge></button></li>)}
              </ul>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {db.demo && <Badge tone="orange">Demo data</Badge>}
            <div className="relative">
              <button className="focus-ring relative rounded-xl p-2 hover:bg-blue-50" aria-label={`Notifications, ${unread.length} unread`} onClick={() => { setBell((b) => !b); setMenu(false); }}>
                <Bell size={18} />{unread.length > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{unread.length}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-line bg-white p-2 shadow-xl">
                  <div className="flex items-center justify-between px-2 py-1"><span className="text-sm font-semibold">Notifications</span><button className="text-xs text-blue-600" onClick={() => actions.markAllRead()}>Mark all read</button></div>
                  <ul className="max-h-72 overflow-auto">{db.notifications.filter((n) => !n.userId || n.userId === me.id).slice(0, 12).map((n) => <li key={n.id} className={cx("rounded-lg px-2 py-2 text-sm", !n.read && "bg-blue-50")}>{n.title}</li>)}{db.notifications.length === 0 && <li className="px-2 py-4 text-sm text-muted">You're all caught up.</li>}</ul>
                </div>
              )}
            </div>
            <div className="relative">
              <button className="focus-ring flex items-center gap-2 rounded-xl p-1.5 hover:bg-blue-50" onClick={() => { setMenu((m) => !m); setBell(false); }} aria-label="User menu">
                <Avatar name={me.name} /><span className="hidden text-left text-xs leading-tight sm:block"><b className="block text-sm">{me.name}</b><span className="text-muted">{ROLE_LABEL[me.role]}</span></span>
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
                  {db.demo && <><p className="px-2 pb-1 pt-1 text-xs font-medium text-muted">Switch demo user (role preview)</p>
                  <div className="max-h-56 overflow-auto">{db.members.filter((m) => m.status === "active").map((m) => <button key={m.id} onClick={() => { session.signInAs(m.id); setMenu(false); nav("/"); }} className={cx("focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-blue-50", m.id === me.id && "bg-blue-50")}><Avatar name={m.name} size={24} /><span className="min-w-0"><span className="block truncate">{m.name}</span><span className="text-xs text-muted">{ROLE_LABEL[m.role]}</span></span></button>)}</div></>}
                  <button onClick={() => session.signOut()} className="focus-ring mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-blue-50"><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" onClick={() => { setBell(false); setMenu(false); }}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/verticals" element={<Verticals />} />
            <Route path="/campaigns" element={<CampaignList />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/crm" element={<Crm />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/calling" element={<Calling />} />
            <Route path="/social" element={<Social />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/ai" element={<Assistant />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/team" element={<Team />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function search(db: ReturnType<typeof useStore>["db"], me: NonNullable<ReturnType<typeof useStore>["me"]>, q: string) {
  const camps = visibleCampaigns(db, me);
  const ids = new Set(camps.map((c) => c.id));
  const out: { key: string; label: string; kind: string; to: string; tone: "blue" | "green" | "orange" }[] = [];
  camps.filter((c) => c.name.toLowerCase().includes(q)).forEach((c) => out.push({ key: c.id, label: c.name, kind: "Campaign", to: `/campaigns/${c.id}`, tone: "blue" }));
  if (canSeeClients(me)) db.clients.filter((c) => c.name.toLowerCase().includes(q)).forEach((c) => out.push({ key: c.id, label: c.name, kind: "Client", to: "/clients", tone: "orange" }));
  if (canSeeCrm(me)) db.leads.filter((l) => ids.has(l.campaignId)).forEach((l) => { const c = db.contacts.find((x) => x.id === l.contactId); if (c && (c.name + c.email + c.company).toLowerCase().includes(q)) out.push({ key: l.id, label: `${c.name} · ${c.company}`, kind: "Lead", to: `/crm?lead=${l.id}`, tone: "green" }); });
  return out.slice(0, 8);
}
