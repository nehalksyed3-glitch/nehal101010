import { useState } from "react";
import { ChevronDown, PlugZap, RotateCcw } from "lucide-react";
import { Badge, Button, Card, PageHeader, useToast } from "../components/ui";
import { actions, useStore } from "../lib/store";
import { CATEGORIES, INTEGRATION_CATALOG } from "../lib/integrations";
import { can } from "../lib/rbac";
import { fmtDateTime } from "../lib/util";

export default function Integrations() {
  const { db, me } = useStore();
  const { run, node } = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const manage = can(me, "integration.manage");
  return (
    <>
      <PageHeader title="Integration Hub" sub="Nothing here reports success without a real provider response. Connections activate once credentials are added as backend secrets." />
      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const items = db.integrations.filter((i) => i.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{cat}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((i) => {
                  const spec = INTEGRATION_CATALOG.find((c) => c.provider === i.provider);
                  const isOpen = open === i.id;
                  return (
                    <Card key={i.id} className="!p-4">
                      <button className="focus-ring flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i.id)}>
                        <span className="font-medium">{i.provider}</span>
                        <span className="flex items-center gap-2"><Badge tone={i.status === "connected" ? "green" : i.status === "error" ? "red" : "gray"}>{i.status === "not_connected" ? "Not connected" : i.status === "error" ? "Error" : "Connected"}</Badge><ChevronDown size={16} className={isOpen ? "rotate-180" : ""} /></span>
                      </button>
                      {isOpen && spec && (
                        <div className="mt-3 space-y-3 text-sm">
                          <p><b>Setup:</b> {spec.setup}</p><p><b>Permissions:</b> {spec.permissions}</p>
                          <div><b>Required secrets:</b><ul className="mt-1 flex flex-wrap gap-1">{spec.secrets.map((s) => <li key={s} className="rounded-md bg-canvas px-2 py-0.5 font-mono text-xs">{s}</li>)}</ul></div>
                          <p className="text-xs text-muted">Last sync: {i.lastSyncAt ? fmtDateTime(i.lastSyncAt) : "never"}</p>
                          {i.errors.length > 0 && <ul className="space-y-1 rounded-xl bg-red-50 p-3 text-xs text-red-700">{i.errors.slice(0, 3).map((e, k) => <li key={k}>{fmtDateTime(e.at)} — {e.message}</li>)}</ul>}
                          {manage && <div className="flex gap-2"><Button variant="soft" onClick={() => run(() => actions.testIntegration(i.id), "Test completed")}><PlugZap size={15} /> Test connection</Button><Button variant="ghost" onClick={() => run(() => actions.resetIntegration(i.id), "Status reset")}><RotateCcw size={15} /> Reset</Button></div>}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {node}
    </>
  );
}
