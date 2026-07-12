import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { MARKETPLACE_COLORS } from '../../lib/utils'

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  color: '#475569',
  fontSize: '13px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
}

const TOOLTIP_ITEM_STYLE = { color: '#475569' }
const TOOLTIP_LABEL_STYLE = { color: '#94A3B8', marginBottom: '4px' }

export const RevenueAreaChart = ({ data, labels }: { data: { name: string; data: number[] }[]; labels: string[] }) => {
  const chartData = labels.map((label, i) => ({
    label,
    Revenue: data[0]?.data[i] ?? 0,
    Profit: data[1]?.data[i] ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, undefined]} />
        <Area type="monotone" dataKey="Revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revGrad)" animationDuration={800} />
        <Area type="monotone" dataKey="Profit" stroke="#16A34A" strokeWidth={2} fill="url(#profGrad)" animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export const MarketplaceBarChart = ({ data }: { data: Record<string, { revenue: number; orders: number }> }) => {
  const chartData = Object.entries(data).map(([name, v]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...v }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={28} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} animationDuration={800}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={MARKETPLACE_COLORS[entry.name.toLowerCase()] ?? '#2563EB'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const DONUT_COLORS = ['#2563EB', '#16A34A', '#D97706', '#0284C7', '#DC2626', '#7C3AED']

export const ExpenseDonut = ({ data }: { data: Array<{ name: string; value: number }> }) => (
  <ResponsiveContainer width="100%" height={180}>
    <PieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" animationDuration={800}>
        {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
      </Pie>
      <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, undefined]} />
    </PieChart>
  </ResponsiveContainer>
)

export const Sparkline = ({ data, color = '#2563EB' }: { data: number[]; color?: string }) => {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} animationDuration={600} />
      </LineChart>
    </ResponsiveContainer>
  )
}
