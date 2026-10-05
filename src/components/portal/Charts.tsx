import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, XAxis } from "recharts";
import { money, prettyStatus } from "@/lib/prop3000";
import { statusTone, type StatusTone } from "@/lib/status";

type Point = { name: string; value: number };

/** Chart fills come from the design tokens in src/styles.css, never hex. */
const TONE_FILL: Record<StatusTone, string> = {
  wait: "var(--color-accent)",
  motion: "var(--color-primary)",
  good: "var(--color-success)",
  bad: "var(--color-brick)",
  neutral: "var(--color-chart-5)",
};

const TONE_BG: Record<StatusTone, string> = {
  wait: "bg-accent",
  motion: "bg-primary",
  good: "bg-success",
  bad: "bg-brick",
  neutral: "bg-chart-5",
};

/** Lead trend over 6 months: current month orange, prior months --chart-5. */
export function LeadTrendBars({ data }: { data: Point[] }) {
  const summary = data.map((d) => `${d.name} ${d.value}`).join(", ");
  return (
    <div role="img" aria-label={`Leads per month: ${summary}`}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 24, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 12 }}
          />
          <Bar dataKey="value" isAnimationActive={false}>
            <LabelList dataKey="value" position="top" fill="var(--color-primary)" fontSize={13} fontWeight={700} />
            {data.map((point, index) => (
              <Cell
                key={point.name}
                fill={index === data.length - 1 ? "var(--color-accent)" : "var(--color-chart-5)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Revenue by stage: horizontal bars, each in its status colour. */
export function StageBars({ data }: { data: { status: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-4">
      {data.map((stage) => (
        <li key={stage.status}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-foreground">{prettyStatus(stage.status)}</span>
            <span className="font-display text-lg font-bold text-primary">{money(stage.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-sm bg-secondary" aria-hidden="true">
            <div
              className={`h-full ${TONE_BG[statusTone(stage.status)]}`}
              style={{ width: `${(stage.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Job status mix as a donut with a coloured legend. */
export function StatusDonut({ data }: { data: Point[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
  const summary = data.map((d) => `${prettyStatus(d.name)} ${d.value}`).join(", ");
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div role="img" aria-label={`Job status mix: ${summary}`} className="size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={78}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((point) => (
                <Cell key={point.name} fill={TONE_FILL[statusTone(point.name)]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2">
        {data.map((point) => (
          <li key={point.name} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-3 rounded-sm ${TONE_BG[statusTone(point.name)]}`} />
            <span className="text-foreground">{prettyStatus(point.name)}</span>
            <span className="font-bold text-foreground">· {point.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Demand by trade: top trades as orange bars with counts. */
export function TradeBars({ data }: { data: Point[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((trade) => (
        <li key={trade.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-3">
          <span className="font-display truncate font-bold uppercase text-foreground">{prettyStatus(trade.name)}</span>
          <span className="h-4 overflow-hidden rounded-sm bg-secondary" aria-hidden="true">
            <span className="block h-full bg-accent" style={{ width: `${(trade.value / max) * 100}%` }} />
          </span>
          <span className="font-display text-right text-lg font-bold text-foreground">{trade.value}</span>
        </li>
      ))}
    </ul>
  );
}