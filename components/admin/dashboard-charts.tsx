'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * SCREEN 9 — dashboard charts.
 *
 * These are the ONLY client components on the dashboard; everything else is
 * rendered on the server. The data arriving here is whatever the stagiaire-safe
 * aggregation returned — an empty list renders an honest empty chart, never a
 * fabricated curve. The mockups' illustrative values (125 / 18 / 25…) are never
 * hard-coded anywhere in the codebase.
 *
 * Client component because Recharts measures the DOM to size its SVG canvas.
 */

const AXIS = '#64748B'
const GRID = '#E9EEF6'

/** Red = up / accepted, green = down / rejected. Moroccan stock convention is
 *  irrelevant here; these are semantic status colours matching STATUS_META. */
const STATUS_COLORS: Record<string, string> = {
  Envoyée: '#F59E0B',
  'En examen': '#2563EB',
  Acceptée: '#10B981',
  Refusée: '#EF4444',
  Brouillon: '#94A3B8',
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center px-6">
      <p className="text-center text-[13px] leading-relaxed text-ink-subtle">{message}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Monthly volume                                                              */
/* -------------------------------------------------------------------------- */

export function MonthlyApplicationsChart({
  data,
}: {
  data: { month: string; label: string; count: number }[]
}) {
  const hasData = data.some((point) => point.count > 0)

  if (data.length === 0 || !hasData) {
    return (
      <ChartEmpty message="Aucune candidature enregistrée sur la période. Le graphique s’alimentera automatiquement dès les premières demandes." />
    )
  }

  return (
    <div className="h-[240px] w-full px-1 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -18 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${GRID}`,
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(11,23,54,0.08)',
            }}
            labelStyle={{ color: '#0B1736', fontWeight: 600 }}
            formatter={(value: number) => [`${value} demande${value > 1 ? 's' : ''}`, 'Total']}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#2563EB"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#2563EB', strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Status distribution                                                         */
/* -------------------------------------------------------------------------- */

export function StatusDistributionChart({
  data,
}: {
  data: { name: string; value: number }[]
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0)

  if (total === 0) {
    return (
      <ChartEmpty message="Aucune donnée à répartir pour le moment. La répartition par statut apparaîtra dès qu’une demande sera créée." />
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
      <div className="h-[190px] w-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={84}
              paddingAngle={2}
              stroke="#FFFFFF"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94A3B8'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: `1px solid ${GRID}`,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `${value} (${Math.round((value / total) * 100)} %)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Real legend with real counts — a screen reader gets the same numbers. */}
      <ul className="w-full min-w-0 space-y-2.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[entry.name] ?? '#94A3B8' }}
              />
              <span className="truncate text-ink-muted">{entry.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {entry.value}
              <span className="ml-1.5 text-2xs font-normal text-ink-subtle">
                {total > 0 ? `${Math.round((entry.value / total) * 100)} %` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Weekly / per-formation bars                                                 */
/* -------------------------------------------------------------------------- */

export function ApplicationsBarChart({
  data,
  emptyMessage,
}: {
  data: { name: string; value: number }[]
  emptyMessage: string
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0)
  if (data.length === 0 || total === 0) return <ChartEmpty message={emptyMessage} />

  return (
    <div className="h-[240px] w-full px-1 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(37,99,235,0.06)' }}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${GRID}`,
              fontSize: 12,
            }}
            formatter={(value: number) => [value, 'Demandes']}
          />
          <Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
