import React, { useMemo } from "react";
import {
  BarChart,
  CartesianGrid,
  Bar,
  XAxis,
  YAxis,
  Label,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useDashboardStats } from "../../hooks/useDashboardStats";

const HOURS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00","19:00",
];

const Chart: React.FC = () => {
  const { data: stats, isLoading } = useDashboardStats();

  const chartData = useMemo(() => {
    const base = HOURS.map((time) => ({ time, amount: 0 }));
    if (!stats?.ticketsByHour) return base;
    return base.map((d) => ({ ...d, amount: stats.ticketsByHour[d.time] || 0 }));
  }, [stats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          barSize={40}
          margin={{ top: 16, right: 16, bottom: 0, left: 24 }}
        >
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
          <YAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))">
            <Label
              angle={270}
              position="left"
              style={{ textAnchor: "middle", fill: "hsl(var(--foreground))", fontSize: 12 }}
            >
              Tickets
            </Label>
          </YAxis>
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            labelFormatter={(label) => `${label}h`}
            formatter={(value: number) => [value, "Tickets"]}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Bar dataKey="amount" fill="url(#colorAmount)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
};

export default Chart;
