import { useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Plus } from "lucide-react";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, useToast } from "../components/ui";
import { actions, useStore } from "../lib/store";
import { can } from "../lib/rbac";
import { kpis } from "../lib/metrics";
import { money } from "../lib/util";
import type { Vertical } from "../lib/types";

export default function Verticals() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [edit, setEdit] = useState<Partial<Vertical> | null>(null);
  const visible = me?.role === "vertical_manager" ? db.verticals.filter((v) => me.verticalIds.includes(v.id)) : db.verticals;
  const tone = { blue: "bg-blue-600", orange: "bg-orange-500", green: "bg-green-500" } as const;
  return (
    <>
      <PageHeader title="Business Verticals" sub="Internal departments and brands that own campaigns." action={can(me, "vertical.write") && <Button onClick={() => setEdit({ name: "", description: "", color: "blue" })}><Plus size={16} /> New vertical</Button>} />
      {visible.length === 0 ? <Empty title="No verticals yet" hint="Create your first business vertical to start organising internal campaigns." action={can(me, "vertical.write") && <Button onClick={() => setEdit({ name: "", description: "", color: "blue" })}>Create vertical</Button>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((v) => {
            const camps = db.campaigns.filter((c) => c.verticalId === v.id);
            const ids = camps.map((c) => c.id);
            const k = kpis(db.calls.filter((c) => ids.includes(c.campaignId)), db.leads.filter((l) => ids.includes(l.campaignId)));
            const mgr = db.members.find((m) => m.id === v.managerId);
            return (
              <Card key={v.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${tone[v.color]}`}><Layers size={18} /></span>{can(me, "vertical.write") && <button className="text-xs text-blue-600" onClick={() => setEdit(v)}>Edit</button>}</div>
                <div><h3 className="text-lg font-semibold">{v.name}</h3><p className="text-sm text-muted">{v.description || "No description"}</p></div>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-center text-sm"><div><b className="block text-lg">{camps.length}</b>Campaigns</div><div><b className="block text-lg">{k.sales}</b>Sales</div><div><b className="block text-lg">{money(k.revenue)}</b>Revenue</div></div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">{mgr && <Badge tone="blue">Manager: {mgr.name}</Badge>}{camps.slice(0, 3).map((c) => <Link key={c.id} to={`/campaigns/${c.id}`}><Badge tone="gray">{c.name}</Badge></Link>)}</div>
              </Card>
            );
          })}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? "Edit vertical" : "New vertical"} onClose={() => setEdit(null)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.saveVertical(edit as Vertical), "Vertical saved")) setEdit(null); }}>
            <Field label="Name">{(id) => <Input id={id} required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
            <Field label="Description">{(id) => <Textarea id={id} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}</Field>
            <Field label="Accent">{(id) => <Select id={id} value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value as Vertical["color"] })}><option value="blue">Blue</option><option value="orange">Orange</option><option value="green">Green</option></Select>}</Field>
            <Field label="Manager">{(id) => <Select id={id} value={edit.managerId ?? ""} onChange={(e) => setEdit({ ...edit, managerId: e.target.value || undefined })}><option value="">None</option>{db.members.filter((m) => m.status === "active" && m.role !== "client_portal").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        </Modal>
      )}
      {node}
    </>
  );
}
