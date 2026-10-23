import { useState } from "react";
import { ArrowRight, Building2, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button, Field, Input, useToast } from "../components/ui";
import { session } from "../lib/store";
import { buildDemo } from "../lib/seed";

export default function Login() {
  const [org, setOrg] = useState("Assorted Group");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { run, node } = useToast();
  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="bento-hero hidden flex-col justify-between rounded-none p-12 lg:flex">
        <Logo light size={44} />
        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold leading-[1.05]">One platform for every business we run.</h1>
          <p className="mt-5 text-lg text-white/75">Verticals, clients, campaigns, CRM, calling, integrations, AI and reporting, with access controlled by role.</p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {[[Building2, "Multi-tenant hierarchy"], [PhoneCall, "Rules-aware calling"], [ShieldCheck, "Role-based access"]].map(([I, t], i) => {
              const Icon = I as typeof Building2;
              return <div key={i} className="rounded-2xl border border-white/15 bg-white/8 p-4"><Icon size={20} className={["text-[#7fb0ff]", "text-orange-500", "text-green-500"][i]} /><p className="mt-2 font-medium">{t as string}</p></div>;
            })}
          </div>
        </div>
        <p className="text-xs text-white/50">© Assorted Group</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden"><Logo /></div>
          <div className="bento space-y-4 p-6">
            <div><h2 className="text-xl font-semibold">Create your workspace</h2><p className="mt-1 text-sm text-muted">You become the Super Administrator. Data stays in this browser until the Supabase backend is connected (see README).</p></div>
            <Field label="Organization">{(id) => <Input id={id} value={org} onChange={(e) => setOrg(e.target.value)} />}</Field>
            <Field label="Your name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}</Field>
            <Field label="Work email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}</Field>
            <Button className="w-full" onClick={() => run(() => session.createWorkspace(org, name, email))}>Create workspace <ArrowRight size={16} /></Button>
          </div>
          <div className="bento flex items-center justify-between gap-4 p-5">
            <div><p className="flex items-center gap-2 font-semibold"><Sparkles size={16} className="text-orange-500" /> Explore the demo</p><p className="mt-1 text-sm text-muted">Fictional data with all roles. Calling is simulated and labelled.</p></div>
            <Button variant="accent" onClick={() => { const d = buildDemo(); session.loadDemo(d.db, d.adminId); }}>Open demo</Button>
          </div>
        </div>
      </div>
      {node}
    </div>
  );
}
