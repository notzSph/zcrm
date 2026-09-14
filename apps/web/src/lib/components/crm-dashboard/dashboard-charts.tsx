"use client";

import { useMemo } from "react";
import {
  Activity,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import { LeadStatus, type Lead } from "@/lib/types";
import styles from "./crm-dashboard.module.scss";

ChartJS.register(
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const statusMeta = [
  { status: LeadStatus.Target, label: "Target", color: "#c8c0ff" },
  { status: LeadStatus.Connected, label: "Connected", color: "#49ace9" },
  { status: LeadStatus.Contacted, label: "Contacted", color: "#49d6e9" },
  { status: LeadStatus.Meeting, label: "Meeting", color: "#e4b781" },
  { status: LeadStatus.Proposal, label: "Proposal", color: "#9b87ff" },
  { status: LeadStatus.Won, label: "Won", color: "#49e9a6" },
  { status: LeadStatus.Lost, label: "Lost", color: "#df769b" },
  { status: LeadStatus.Nurture, label: "Nurture", color: "#aaa5c4" },
];

const doughnutOptions: ChartOptions<"doughnut"> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "70%",
  animation: { duration: 450 },
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: true,
      backgroundColor: "#1a182a",
      borderColor: "rgba(200, 192, 255, .28)",
      borderWidth: 1,
      padding: 10,
      titleColor: "#faf8ff",
      bodyColor: "#d7d3e8",
    },
  },
};

const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const lineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" },
  animation: { duration: 450 },
  scales: {
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: "#aaa5c4", maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: "rgba(200, 192, 255, .09)" },
      ticks: { color: "#aaa5c4", precision: 0, stepSize: 1 },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1a182a",
      borderColor: "rgba(200, 192, 255, .28)",
      borderWidth: 1,
      padding: 10,
      titleColor: "#faf8ff",
      bodyColor: "#d7d3e8",
    },
  },
};

export default function DashboardCharts({ leads }: { leads: Lead[] }) {
  const distribution = useMemo(
    () => statusMeta
      .map((item) => ({ ...item, value: leads.filter((lead) => lead.status === item.status).length }))
      .filter((item) => item.value > 0),
    [leads],
  );

  const activityTrend = useMemo(() => {
    const points = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (13 - index));
      return { date, key: localDayKey(date), value: 0 };
    });
    const lookup = new Map(points.map((point) => [point.key, point]));
    leads.forEach((lead) => {
      lead.activities.forEach((activity) => {
        const key = localDayKey(new Date(activity.created_at));
        const point = lookup.get(key);
        if (point) point.value += 1;
      });
    });
    return points;
  }, [leads]);

  if (!leads.length) return null;

  const activityTotal = activityTrend.reduce((sum, point) => sum + point.value, 0);
  const activeCount = leads.filter((lead) => ![LeadStatus.Won, LeadStatus.Lost, LeadStatus.Nurture].includes(lead.status)).length;
  const topStatus = [...distribution].sort((a, b) => b.value - a.value)[0];

  const distributionData = {
    labels: distribution.map((item) => item.label),
    datasets: [{
      data: distribution.map((item) => item.value),
      backgroundColor: distribution.map((item) => item.color),
      borderColor: "#1a182a",
      borderWidth: 3,
      hoverOffset: 5,
    }],
  };
  const activityData = {
    labels: activityTrend.map((point) => point.date.toLocaleDateString("en", { month: "short", day: "numeric" })),
    datasets: [{
      data: activityTrend.map((point) => point.value),
      borderColor: "#9b87ff",
      backgroundColor: "rgba(121, 103, 244, .18)",
      pointBackgroundColor: "#c8c0ff",
      pointBorderColor: "#242038",
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      tension: .38,
      fill: true,
    }],
  };

  return (
    <article className={`${styles.chartCard} ${styles.topChart}`} aria-label="Pipeline insights">
      <header className={styles.chartHeader}>
        <div><span><BarChart3 size={15} /> Pipeline pulse</span><h2>Status & activity</h2></div>
        <em>{activeCount} active</em>
      </header>
      <div className={styles.pulseCharts}>
        <div className={styles.pulsePanel}>
          <div className={styles.compactDoughnut}>
            <Doughnut data={distributionData} options={doughnutOptions} aria-label="Lead status distribution chart" role="img" />
            <div className={styles.chartCenter}><strong>{leads.length}</strong><span>leads</span></div>
          </div>
          <p><TrendingUp size={13} /> <strong>{topStatus.label}</strong> · {Math.round((topStatus.value / leads.length) * 100)}%</p>
        </div>
        <div className={styles.pulsePanel}>
          {activityTotal > 0 ? (
            <div className={styles.compactLine}><Line data={activityData} options={lineOptions} aria-label="Recorded activity trend over the last 14 days" role="img" /></div>
          ) : (
            <div className={styles.compactEmpty}><Activity size={19} /><span>No recent activity</span></div>
          )}
          <p><Activity size={13} /> <strong>{activityTotal}</strong> event{activityTotal === 1 ? "" : "s"} · 14 days</p>
        </div>
      </div>
    </article>
  );
}
