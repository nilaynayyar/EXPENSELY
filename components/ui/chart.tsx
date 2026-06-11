"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Prevents SSR hydration issues
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <div className="h-full w-full bg-surface-container-low/20 animate-pulse rounded-lg" />;
  return <>{children}</>;
}

// Returns theme-aware inline styles for recharts Tooltip (cannot use CSS classes here)
function useTooltipStyle() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return {
    background: isDark ? "rgba(19, 31, 46, 0.95)" : "rgba(255, 255, 255, 0.95)",
    border: isDark ? "1px solid rgba(108, 122, 113, 0.3)" : "1px solid #E2E8F0",
    borderRadius: "8px",
    color: isDark ? "#eaf1ff" : "#0b1c30",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  };
}

// Spending Trends (Line Chart)
export function SpendingLineChart({ data }: { data: any[] }) {
  const tooltipStyle = useTooltipStyle();
  return (
    <ClientOnly>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#006591" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#006591" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.3)" />
          <XAxis
            dataKey="name"
            stroke="#6c7a71"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6c7a71"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`₹${value}`, "Spent"]}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#006591"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ClientOnly>
  );
}

// Weekly Comparison (Bar Chart)
export function SpendingBarChart({ data }: { data: any[] }) {
  const tooltipStyle = useTooltipStyle();
  return (
    <ClientOnly>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.3)" />
          <XAxis
            dataKey="name"
            stroke="#6c7a71"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6c7a71"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`₹${value}`, "Amount"]}
          />
          <Bar dataKey="thisWeek" fill="#10b981" radius={[4, 4, 0, 0]} name="This Week" />
          <Bar dataKey="lastWeek" fill="#bbcabf" radius={[4, 4, 0, 0]} name="Last Week" />
        </BarChart>
      </ResponsiveContainer>
    </ClientOnly>
  );
}

// Category Breakdown (Pie Chart)
export function CategoryPieChart({ data }: { data: any[] }) {
  const COLORS = ["#006591", "#10b981", "#6d3bd7", "#ba1a1a", "#39b8fd"];
  const tooltipStyle = useTooltipStyle();

  return (
    <ClientOnly>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`₹${value}`, "Spent"]}
          />
        </PieChart>
      </ResponsiveContainer>
    </ClientOnly>
  );
}
