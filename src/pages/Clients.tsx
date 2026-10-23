import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, useToast } from "../components/ui";
import { AssetsPanel } from "../components/AssetsPanel";
import { actions, useStore } from "../lib/store";
import { can } from "../lib/rbac";
import { kpis } from "../lib/metrics";
import { money } from "../lib/util";
import type { Client } from "../lib/types";

export default function Clients() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [edit, setEdit] = useState<Partial<Client> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const visible = me?.role === "client_manager" ? db.clients.filter((c) => c.managerId === me.id) : db.clients;
  const blank = { name: "", industry: "", website: "", contactName: "", contactEmail: "", status: "active" as const };
  const sel = db.clients.find((c) => c.id === open);
  return (
    <>
      <PageHeader title="Client Management" sub="External accounts, their campaigns, URLs and performance." action={can(me, "client.write") && <Button onClick={() => setEdit(blank)}><Plus size={16} /> New client</Button>} />
      {visible.length === 0 ? <Empty title="No clients yet" hint="Add an external client to commission campaigns on their behalf." action={can(me, "client.write") && <Button onClick={() => setEdit(blank)}>Add client</Button>} /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            {visible.map((c) => {
              const camps = db.campaigns.filter((x) => x.clientId === c.id); const ids = camps.map((x) => x.id);
              const k = kpis(db.calls.filter((x) => ids.includes(x.campaignId)), db.leads.filter((l) => ids.includes(l.campaignId)));
              return (
                <button key={c.id} onClick={() => setOpen(c.id)} className={`focus-ring bento w-full p-4 text-left transition hover:border-blue-500 ${open === c.id ? "!border-blue-600 ring-2 ring-blue-100" : ""}`}>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><Building2 size={16} className="text-orange-500" />{c.name}</span><Badge tone={c.status === "active" ? "green" : c.status === "prospect" ? "orange" : "gray"}>{c.status}</Badge></div>
                  <p className="mt-1 text-sm text-muted">{c.industry || "—"} · {camps.length} campaigns · {k.sales} sales · {money(k.revenue)}</p>
                </button>
              );
            })}
          </div>
          <div>
            {sel ? (
              <Card className="space-y-4">
                <div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">{sel.name}</h2><a className="text-sm text-blue-600" href={sel.website} target="_blank" rel="noopener noreferrer">{sel.website}</a></div>{can(me, "client.write") && <Button variant="ghost" onClick={() => setEdit(sel)}>Edit</Button>}</div>
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 text-sm"><div><p className="text-xs text-muted">Primary contact</p>{sel.contactName || "—"}<br /><span className="text-muted">{sel.contactEmail}</span></div><div><p className="text-xs text-muted">Client manager</p>{db.members.find((m) => m.id === sel.managerId)?.name ?? "Unassigned"}</div></div>
                <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Campaigns</p>{db.campaigns.filter((c) => c.clientId === sel.id).map((c) => <Link key={c.id} to={`/campaigns/${c.id}`} className="mb-1 flex justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-blue-50"><span>{c.name}</span><Badge tone={c.status === "active" ? "green" : "gray"}>{c.status}</Badge></Link>)}{!db.campaigns.some((c) => c.clientId === sel.id) && <p className="text-sm text-muted">No campaigns yet.</p>}</div>
                <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Website URLs</p><AssetsPanel clientId={sel.id} /></div>
              </Card>
            ) : <Empty title="Select a client" hint="See campaigns, contacts and registered URLs." />}
          </div>
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? "Edit client" : "New client"} onClose={() => setEdit(null)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.saveClient(edit as Client), "Client saved")) setEdit(null); }}>
            <Field label="Company name">{(id) => <Input id={id} required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Industry">{(id) => <Input id={id} value={edit.industry ?? ""} onChange={(e) => setEdit({ ...edit, industry: e.target.value })} />}</Field>
              <Field label="Status">{(id) => <Select id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Client["status"] })}><option value="active">Active</option><option value="prospect">Prospect</option><option value="paused">Paused</option></Select>}</Field>
              <Field label="Contact name">{(id) => <Input id={id} value={edit.contactName ?? ""} onChange={(e) => setEdit({ ...edit, contactName: e.target.value })} />}</Field>
              <Field label="Contact email">{(id) => <Input id={id} type="email" value={edit.contactEmail ?? ""} onChange={(e) => setEdit({ ...edit, contactEmail: e.target.value })} />}</Field>
            </div>
            <Field label="Website">{(id) => <Input id={id} value={edit.website ?? ""} onChange={(e) => setEdit({ ...edit, website: e.target.value })} placeholder="https://" />}</Field>
            <Field label="Client manager">{(id) => <Select id={id} value={edit.managerId ?? ""} onChange={(e) => setEdit({ ...edit, managerId: e.target.value || undefined })}><option value="">Unassigned</option>{db.members.filter((m) => m.status === "active" && m.role !== "client_portal").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        </Modal>
      )}
      {node}
    </>
  );
}
