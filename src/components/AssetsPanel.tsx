import { useState } from "react";
import { ExternalLink, Globe2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Empty, Field, Input, Modal, Select, Textarea, useToast } from "./ui";
import { actions, useStore } from "../lib/store";
import { can } from "../lib/rbac";
import type { Asset } from "../lib/types";

const CAT: Record<Asset["category"], string> = { website: "Website", landing_page: "Landing page", social: "Social profile", form: "Lead form", other: "Other" };

export function AssetsPanel({ campaignId, clientId, onlySocial }: { campaignId?: string; clientId?: string; onlySocial?: boolean }) {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [add, setAdd] = useState(false);
  const list = db.assets.filter((a) => (campaignId ? a.campaignId === campaignId : clientId ? a.clientId === clientId : true) && (!onlySocial || a.category === "social"));
  return (
    <div className="space-y-3">
      {can(me, "asset.write") && <div className="flex justify-end"><Button onClick={() => setAdd(true)}><Plus size={16} /> Register URL</Button></div>}
      {list.length === 0 ? <Empty title="No URLs registered" hint="Registering a URL stores and displays it. Private data access needs an authenticated integration." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="bento flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Globe2 size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.label}</p>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-sm text-blue-600">{a.url}<ExternalLink size={12} /></a>
                {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="blue">{CAT[a.category]}</Badge><Badge tone="gray">URL registered only</Badge>{a.intendedUse && <Badge tone="green">{a.intendedUse}</Badge>}</div>
              </div>
              {can(me, "asset.write") && <button aria-label={`Remove ${a.label}`} className="focus-ring rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600" onClick={() => run(() => actions.removeAsset(a.id), "Removed")}><Trash2 size={16} /></button>}
            </li>
          ))}
        </ul>
      )}
      {add && <AddAsset campaignId={campaignId} clientId={clientId} onlySocial={onlySocial} onClose={() => setAdd(false)} run={run} />}
      {node}
    </div>
  );
}

function AddAsset({ campaignId, clientId, onlySocial, onClose, run }: { campaignId?: string; clientId?: string; onlySocial?: boolean; onClose: () => void; run: ReturnType<typeof useToast>["run"] }) {
  const { db } = useStore();
  const [f, setF] = useState({ url: "", label: "", description: "", category: (onlySocial ? "social" : "website") as Asset["category"], intendedUse: "", campaignId: campaignId ?? "", clientId: clientId ?? "", verticalId: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="Register URL" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.addAsset({ ...f, campaignId: f.campaignId || undefined, clientId: f.clientId || undefined, verticalId: f.verticalId || undefined }), "URL registered")) onClose(); }}>
        <Field label="URL" hint="Localhost, private IPs and credentialed URLs are rejected.">{(id) => <Input id={id} value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" required />}</Field>
        <Field label="Label">{(id) => <Input id={id} value={f.label} onChange={(e) => set("label", e.target.value)} required />}</Field>
        <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={(e) => set("category", e.target.value)}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Intended use">{(id) => <Input id={id} value={f.intendedUse} onChange={(e) => set("intendedUse", e.target.value)} placeholder="Lead capture, brand, reporting…" />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => set("description", e.target.value)} />}</Field>
        {!campaignId && !clientId && <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Campaign">{(id) => <Select id={id} value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)}><option value="">None</option>{db.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
          <Field label="Client">{(id) => <Select id={id} value={f.clientId} onChange={(e) => set("clientId", e.target.value)}><option value="">None</option>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
        </div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Register</Button></div>
      </form>
    </Modal>
  );
}
