// ============================================================
// charts.js — thin themed wrapper around Chart.js (loaded via CDN)
// ============================================================

const PALETTE = ['#2563EB', '#14B8A6', '#1E3A8A', '#F59E0B', '#DC2626', '#8B5CF6', '#0EA5E9', '#65A30D'];

function themeColors() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    text: dark ? '#94A3B8' : '#64748B',
    grid: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
  };
}

const registry = {};

function baseOptions(extra = {}) {
  const { text, grid } = themeColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: text, font: { family: 'Inter', size: 11 }, boxWidth: 10, usePointStyle: true } },
      tooltip: { backgroundColor: '#0F172A', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, padding: 10, cornerRadius: 8 },
    },
    scales: extra.noScales ? {} : {
      x: { ticks: { color: text, font: { size: 11 } }, grid: { color: 'transparent' } },
      y: { ticks: { color: text, font: { size: 11 } }, grid: { color: grid }, beginAtZero: true },
    },
    ...extra.overrides,
  };
}

function render(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (registry[id]) registry[id].destroy();
  registry[id] = new Chart(el.getContext('2d'), config);
}

export function lineChart(id, labels, datasets) {
  render(id, {
    type: 'line',
    data: { labels, datasets: datasets.map((d, i) => ({
      tension: .35, fill: true, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4,
      borderColor: PALETTE[i % PALETTE.length],
      backgroundColor: `${PALETTE[i % PALETTE.length]}1f`,
      ...d,
    })) },
    options: baseOptions(),
  });
}

export function barChart(id, labels, datasets, horizontal = false) {
  render(id, {
    type: 'bar',
    data: { labels, datasets: datasets.map((d, i) => ({
      borderRadius: 6, maxBarThickness: 28,
      backgroundColor: PALETTE[i % PALETTE.length],
      ...d,
    })) },
    options: { ...baseOptions(), indexAxis: horizontal ? 'y' : 'x' },
  });
}

export function doughnutChart(id, labels, data) {
  render(id, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 6 }] },
    options: { ...baseOptions({ noScales: true }), cutout: '68%' },
  });
}
