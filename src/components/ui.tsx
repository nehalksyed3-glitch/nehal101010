import { useEffect, useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Denied } from "../lib/store";

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export function Card({ children, className, hero }: { children: ReactNode; className?: string; hero?: boolean }) {
  return <section className={cx(hero ? "bento-hero" : "bento", "p-5 rise", className)}>{children}</section>;
}
export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold">{children}</h3>{action}</div>;
}

const tones = {
  blue: "bg-blue-100 text-navy-900", orange: "bg-orange-100 text-[#9a4d00]", green: "bg-green-100 text-[#0b6b4c]",
  gray: "bg-slate-100 text-slate-600", red: "bg-red-100 text-red-700",
} as const;
export type Tone = keyof typeof tones;
export const Badge = ({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) => (
  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>{children}</span>
);

export function Button({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "accent" | "danger" | "soft" }) {
  const v = {
    primary: "bg-navy-900 text-white hover:bg-navy-800", accent: "bg-orange-500 text-white hover:brightness-95",
    ghost: "bg-white border border-line text-ink hover:bg-blue-50", soft: "bg-blue-50 text-navy-900 hover:bg-blue-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return <button {...p} className={cx("focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50", v, className)} />;
}

const field = "focus-ring w-full rounded-xl border border-line bg-white px-3 py-2 text-sm placeholder:text-slate-400";
export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="space-y-1"><label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>{children(id)}{hint && <p className="text-xs text-muted">{hint}</p>}</div>;
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(field, "min-h-20", p.className)} />;

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="focus-ring rounded-lg p-1 hover:bg-slate-100"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center"><p className="font-medium">{title}</p>{hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}{action}</div>;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>{action}</div>;
}

export function Stat({ label, value, sub, tone = "blue" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "blue" | "orange" | "green" }) {
  const bar = { blue: "bg-blue-600", orange: "bg-orange-500", green: "bg-green-500" }[tone];
  return <Card className="relative"><span className={cx("absolute left-5 top-0 h-1 w-8 rounded-b-full", bar)} /><p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p><p className="font-display mt-1 text-3xl font-bold">{value}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</Card>;
}

export function Bars({ data, height = 120 }: { data: { label: string; a: number; b?: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.a));
  return (
    <div role="img" aria-label="Bar chart of daily call attempts and connected calls" className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex h-full flex-1 flex-col justify-end gap-0.5" title={`${d.label}: ${d.a} attempts${d.b !== undefined ? `, ${d.b} connected` : ""}`}>
          <div className="relative w-full rounded-t-md bg-blue-100" style={{ height: `${(d.a / max) * 100}%` }}>
            {d.b !== undefined && <div className="absolute bottom-0 w-full rounded-t-md bg-blue-600" style={{ height: `${d.a ? (d.b / d.a) * 100 : 0}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "green" }: { value: number; tone?: "green" | "orange" | "blue" }) {
  const c = { green: "bg-green-500", orange: "bg-orange-500", blue: "bg-blue-600" }[tone];
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}><div className={cx("h-full rounded-full", c)} style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 3;
  const bg = ["bg-blue-600", "bg-orange-500", "bg-green-600"][hue];
  return <span style={{ width: size, height: size }} className={cx("inline-grid shrink-0 place-items-center rounded-full text-xs font-semibold text-white", bg)}>{name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>;
}

/** Toast + guarded action helper: surfaces permission and validation errors as messages. */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); }, [msg]);
  const run = (fn: () => void, ok?: string) => { try { fn(); if (ok) setMsg({ text: ok, tone: "ok" }); return true; } catch (e) { setMsg({ text: (e instanceof Denied ? "Not allowed: " : "") + (e as Error).message, tone: "err" }); return false; } };
  const node = msg && <div role="status" aria-live="polite" className={cx("fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-xl", msg.tone === "ok" ? "bg-green-600" : "bg-red-600")}>{msg.text}</div>;
  return { run, node, toast: (text: string, tone: "ok" | "err" = "ok") => setMsg({ text, tone }) };
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return <div className="scroll-thin overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table></div>;
}
