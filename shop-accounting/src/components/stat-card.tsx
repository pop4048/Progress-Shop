export default function StatCard({
  label, value, sub, tone = "default",
}: { label: string; value: string; sub?: string; tone?: "default" | "up" | "down" }) {
  const toneCls = tone === "up" ? "text-emerald-600" : tone === "down" ? "text-red-600" : "text-slate-900";
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
