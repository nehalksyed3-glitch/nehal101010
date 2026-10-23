import { useState } from "react";
import { Badge, Button, Card, CardTitle, PageHeader, Modal } from "../components/ui";
import { session, useStore } from "../lib/store";
import { CAPS } from "../lib/rbac";
import { ROLE_LABEL, type Role } from "../lib/types";

export default function SettingsPage() {
  const { db, me } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PageHeader title="Settings & Security" sub={`${db.org?.name} · timezone ${db.org?.timezone}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardTitle>Storage mode</CardTitle><p className="text-sm">Data is stored <b>in this browser only</b> (localStorage). It is not shared between users or devices and is not a security boundary. Apply <code>supabase/migrations</code> and connect Supabase to enable real multi-tenant storage with Row-Level Security.</p></Card>
        <Card><CardTitle>Your access</CardTitle><p className="mb-2 text-sm">{me && ROLE_LABEL[me.role]}</p><div className="flex flex-wrap gap-1.5">{me && CAPS[me.role].map((c) => <Badge key={c} tone="blue">{c}</Badge>)}</div></Card>
        <Card className="md:col-span-2"><CardTitle>Role capability matrix</CardTitle><div className="scroll-thin overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-muted"><th className="p-2">Role</th><th className="p-2">Capabilities</th></tr></thead><tbody className="divide-y divide-line">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <tr key={r}><td className="whitespace-nowrap p-2 font-medium">{ROLE_LABEL[r]}</td><td className="p-2 text-muted">{CAPS[r].join(", ")}</td></tr>)}</tbody></table></div></Card>
        <Card className="md:col-span-2"><CardTitle>Data</CardTitle><p className="mb-3 text-sm text-muted">Erase everything stored in this browser, including the demo or your workspace.</p><Button variant="danger" onClick={() => setConfirm(true)}>Erase local workspace</Button></Card>
      </div>
      {confirm && <Modal title="Erase workspace?" onClose={() => setConfirm(false)}><p className="mb-4 text-sm">This permanently deletes all data stored in this browser and signs you out.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { session.reset(); setConfirm(false); }}>Erase</Button></div></Modal>}
    </>
  );
}
