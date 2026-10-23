import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, CardTitle, Field, Input, Modal, PageHeader, Select, Table, useToast } from "../components/ui";
import { actions, useStore } from "../lib/store";
import { can } from "../lib/rbac";
import { ROLE_LABEL, type Role } from "../lib/types";
import { fmtDateTime } from "../lib/util";

export default function Team() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [inv, setInv] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "sales_agent" as Role, clientId: "" });
  const manage = can(me, "member.manage");
  const roles = Object.keys(ROLE_LABEL) as Role[];
  return (
    <>
      <PageHeader title="Team Management" sub="Invite members and assign roles. Permissions are enforced in the data layer, not just hidden in the UI." action={manage && <Button onClick={() => setInv(true)}><UserPlus size={16} /> Invite member</Button>} />
      <Card className="mb-4">
        <Table head={["Member", "Role", "Status", ""]}>{db.members.map((m) => (
          <tr key={m.id}><td className="px-3 py-2.5"><span className="flex items-center gap-2"><Avatar name={m.name} size={28} /><span><b className="block">{m.name}</b><span className="text-xs text-muted">{m.email}</span></span></span></td>
            <td className="px-3 py-2.5">{manage && m.id !== me?.id ? <Select aria-label={`Role for ${m.name}`} className="w-52" value={m.role} onChange={(e) => run(() => actions.setRole(m.id, e.target.value as Role), "Role updated")}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select> : ROLE_LABEL[m.role]}</td>
            <td className="px-3 py-2.5"><Badge tone={m.status === "active" ? "green" : "orange"}>{m.status}</Badge></td>
            <td className="px-3 py-2.5 text-right">{manage && m.status === "invited" && <Button variant="soft" onClick={() => run(() => actions.setMemberStatus(m.id, "active"), "Activated")}>Mark accepted</Button>}</td></tr>
        ))}</Table>
      </Card>
      {can(me, "audit.read") && <Card><CardTitle>Audit log</CardTitle>{db.audit.length ? <Table head={["When", "Actor", "Action", "Target"]}>{db.audit.slice(0, 25).map((a) => <tr key={a.id}><td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(a.createdAt)}</td><td className="px-3 py-2">{db.members.find((m) => m.id === a.actorId)?.name}</td><td className="px-3 py-2"><code className="text-xs">{a.action}</code></td><td className="px-3 py-2 text-muted">{a.target}</td></tr>)}</Table> : <p className="text-sm text-muted">No activity recorded yet.</p>}</Card>}
      {inv && (
        <Modal title="Invite member" onClose={() => setInv(false)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => actions.invite(f.name, f.email, f.role, { clientId: f.clientId || undefined }), "Invitation recorded")) setInv(false); }}>
            <Field label="Name">{(id) => <Input id={id} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
            <Field label="Email">{(id) => <Input id={id} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
            <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>}</Field>
            {f.role === "client_portal" && <Field label="Client">{(id) => <Select id={id} required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">Select…</option>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>}
            <p className="text-xs text-muted">Email delivery needs the backend (Supabase Auth invite). Until then the invite is recorded and can be marked accepted.</p>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setInv(false)}>Cancel</Button><Button type="submit">Invite</Button></div>
          </form>
        </Modal>
      )}
      {node}
    </>
  );
}
