import { useState } from "react";
import { FileText, Link2, Plus } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, useToast } from "../components/ui";
import { actions, useStore } from "../lib/store";
import { can, visibleCampaigns } from "../lib/rbac";
import type { Doc } from "../lib/types";

export default function Documents() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ title: "", kind: "script" as Doc["kind"], storage: "external" as Doc["storage"], reference: "", campaignId: "" });
  const camps = visibleCampaigns(db, me);
  const ids = new Set(camps.map((c) => c.id));
  const docs = db.docs.filter((d) => !d.campaignId || ids.has(d.campaignId));
  return (
    <>
      <PageHeader title="Documents" sub="A registry of scripts, materials and reports. External links stay at the provider; nothing is copied." action={can(me, "doc.write") && <Button onClick={() => setAdd(true)}><Plus size={16} /> Add document</Button>} />
      {docs.length === 0 ? <Empty title="No documents" hint="Register a script, sales material or client document." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{docs.map((d) => (
          <Card key={d.id} className="!p-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-green-100 text-green-600">{d.storage === "external" ? <Link2 size={17} /> : <FileText size={17} />}</span><div className="min-w-0"><p className="font-medium">{d.title}</p><p className="truncate text-xs text-muted">{d.storage === "external" ? <a className="text-blue-600" href={d.reference} target="_blank" rel="noopener noreferrer">{d.reference}</a> : d.reference}</p><div className="mt-2 flex gap-1.5"><Badge tone="blue">{d.kind.replace("_", " ")}</Badge><Badge tone={d.storage === "external" ? "orange" : "gray"}>{d.storage === "external" ? "External link" : "Registry entry"}</Badge></div></div></div></Card>
        ))}</div>
      )}
      {add && (
        <Modal title="Add document" onClose={() => setAdd(false)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.addDoc({ ...f, campaignId: f.campaignId || undefined }), "Document added")) setAdd(false); }}>
            <Field label="Title">{(id) => <Input id={id} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">{(id) => <Select id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Doc["kind"] })}><option value="script">Script</option><option value="sales_material">Sales material</option><option value="report">Report</option><option value="recording">Approved recording</option><option value="client_doc">Client document</option></Select>}</Field>
              <Field label="Location">{(id) => <Select id={id} value={f.storage} onChange={(e) => setF({ ...f, storage: e.target.value as Doc["storage"] })}><option value="external">External link</option><option value="local">Registry note only</option></Select>}</Field>
            </div>
            <Field label={f.storage === "external" ? "Document URL" : "Description"}>{(id) => <Input id={id} required value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder={f.storage === "external" ? "https://" : ""} />}</Field>
            <Field label="Campaign">{(id) => <Select id={id} value={f.campaignId} onChange={(e) => setF({ ...f, campaignId: e.target.value })}><option value="">None</option>{camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdd(false)}>Cancel</Button><Button type="submit">Add</Button></div>
          </form>
        </Modal>
      )}
      {node}
    </>
  );
}
