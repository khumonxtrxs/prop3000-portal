import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { prettyStatus } from "@/lib/prop3000";

const PALETTE = ["#f97316", "#0ea5e9", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#14b8a6"];

const axis = { stroke: "#64748b", fontSize: 11 };

export function TrendChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="name" tick={axis} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip formatter={(value) => [String(value), label]} />
        <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          data={data.map((d) => ({ ...d, name: prettyStatus(d.name) }))}
          dataKey="value"
          nameKey="name"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={3}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CountBars({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data.map((d) => ({ ...d, name: prettyStatus(d.name) }))} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="name" tick={axis} interval={0} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip formatter={(value) => [String(value), label]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MoneyBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 6 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="name" tick={axis} interval={0} />
        <YAxis tick={axis} tickFormatter={(v: number) => `R${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(value) => [`R${Number(value).toLocaleString("en-ZA")}`, "Value"]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0ea5e9" />
      </BarChart>
    </ResponsiveContainer>
  );
}
