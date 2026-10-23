import { Card, PageHeader } from "../components/ui";
import { AssetsPanel } from "../components/AssetsPanel";
import { useStore } from "../lib/store";
import { Link } from "react-router-dom";

export default function Social() {
  const { db } = useStore();
  const accounts = db.integrations.filter((i) => i.category === "Social Media");
  return (
    <>
      <PageHeader title="Social Media" sub="Register profile URLs. Insights and lead ads need an authenticated connection." />
      <Card className="mb-4"><p className="mb-2 text-sm font-medium">Connections</p><div className="flex flex-wrap gap-2">{accounts.map((a) => <span key={a.id} className="rounded-full bg-canvas px-3 py-1 text-sm">{a.provider} · <span className="text-muted">{a.status.replace("_", " ")}</span></span>)}</div><p className="mt-2 text-xs text-muted">Manage OAuth in the <Link className="text-blue-600" to="/integrations">Integration Hub</Link>.</p></Card>
      <AssetsPanel onlySocial />
    </>
  );
}
