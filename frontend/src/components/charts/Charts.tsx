import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { MARKETPLACE_COLORS } from '../../lib/utils'

const TOOLTIP_STYLE = {
  backgroundColor: '#1F2937',
  border: '1px solid rgba(99,102,241,0.2)',
  borderRadius: '12px',
  color: '#F9FAFB',
  fontSize: '13px',
}

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
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, undefined]} />
        <Area type="monotone" dataKey="Revenue" stroke="#6366F1" strokeWidth={2} fill="url(#revGrad)" animationDuration={800} />
        <Area type="monotone" dataKey="Profit" stroke="#10B981" strokeWidth={2} fill="url(#profGrad)" animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export const MarketplaceBarChart = ({ data }: { data: Record<string, { revenue: number; orders: number }> }) => {
  const chartData = Object.entries(data).map(([name, v]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...v }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={28} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="revenue" radius={[6, 6, 0, 0]} animationDuration={800}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={MARKETPLACE_COLORS[entry.name.toLowerCase()] ?? '#6366F1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const DONUT_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6']

export const ExpenseDonut = ({ data }: { data: Array<{ name: string; value: number }> }) => (
  <ResponsiveContainer width="100%" height={180}>
    <PieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" animationDuration={800}>
        {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
      </Pie>
      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, undefined]} />
    </PieChart>
  </ResponsiveContainer>
)

export const Sparkline = ({ data, color = '#6366F1' }: { data: number[]; color?: string }) => {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} animationDuration={600} />
      </LineChart>
    </ResponsiveContainer>
  )
}
