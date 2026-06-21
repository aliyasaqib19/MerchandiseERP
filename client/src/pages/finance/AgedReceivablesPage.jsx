import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);
}

const BUCKETS = [
  { key: 'current', label: 'Current',   color: 'text-green-600',  bg: 'bg-green-50' },
  { key: '1_30',    label: '1–30 days', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  { key: '31_60',   label: '31–60 days',color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: '61_90',   label: '61–90 days',color: 'text-red-600',    bg: 'bg-red-50' },
  { key: '90_plus', label: '90+ days',  color: 'text-red-800',    bg: 'bg-red-100' },
];

export default function AgedReceivablesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-aged-receivables'],
    queryFn: () => api.get('/finance/aged-receivables').then((r) => r.data),
  });

  const summary  = data?.summary  || {};
  const clients  = data?.clients  || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart2 className="w-6 h-6" /> Aged Receivables</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Outstanding balances distributed by age of invoice</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {BUCKETS.map(({ key, label, color, bg }) => (
          <div key={key} className={`border rounded-xl p-4 ${bg}`}>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-lg font-bold mt-1 ${color}`}>{isLoading ? '…' : fmt(summary[key] || 0)}</p>
          </div>
        ))}
        <div className="border rounded-xl p-4 bg-gray-50">
          <p className="text-xs text-muted-foreground font-medium">Total</p>
          <p className="text-lg font-bold mt-1">{isLoading ? '…' : fmt(summary.total || 0)}</p>
        </div>
      </div>

      {/* Percent bar */}
      {summary.total > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Distribution</p>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
            {BUCKETS.map(({ key, color }) => {
              const pct = ((summary[key] || 0) / summary.total) * 100;
              if (pct < 0.5) return null;
              const barColors = {
                current: 'bg-green-400',
                '1_30':  'bg-yellow-400',
                '31_60': 'bg-orange-400',
                '61_90': 'bg-red-400',
                '90_plus': 'bg-red-700',
              };
              return (
                <div
                  key={key}
                  title={`${key}: ${pct.toFixed(1)}%`}
                  className={`${barColors[key]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
            {BUCKETS.map(({ key, label, color }) => {
              const pct = ((summary[key] || 0) / summary.total) * 100;
              if (pct < 0.5) return null;
              return (
                <span key={key} className={`text-xs font-medium ${color}`}>
                  {label}: {pct.toFixed(1)}%
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-client table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-right px-4 py-3 font-medium text-green-700">Current</th>
              <th className="text-right px-4 py-3 font-medium text-yellow-700">1–30</th>
              <th className="text-right px-4 py-3 font-medium text-orange-700">31–60</th>
              <th className="text-right px-4 py-3 font-medium text-red-600">61–90</th>
              <th className="text-right px-4 py-3 font-medium text-red-800">90+</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && clients.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No outstanding receivables</td></tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <Link to={`/clients/${c.id}`} className="font-medium hover:underline text-primary">
                    {c.companyName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-green-700">{c.buckets.current > 0 ? fmt(c.buckets.current) : '—'}</td>
                <td className="px-4 py-3 text-right text-yellow-700">{c.buckets['1_30'] > 0 ? fmt(c.buckets['1_30']) : '—'}</td>
                <td className="px-4 py-3 text-right text-orange-600">{c.buckets['31_60'] > 0 ? fmt(c.buckets['31_60']) : '—'}</td>
                <td className="px-4 py-3 text-right text-red-600">{c.buckets['61_90'] > 0 ? fmt(c.buckets['61_90']) : '—'}</td>
                <td className="px-4 py-3 text-right text-red-800 font-medium">{c.buckets['90_plus'] > 0 ? fmt(c.buckets['90_plus']) : '—'}</td>
                <td className="px-4 py-3 text-right font-bold">{fmt(c.outstandingBalance)}</td>
              </tr>
            ))}
          </tbody>
          {clients.length > 0 && (
            <tfoot className="bg-muted/20 border-t font-semibold">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right text-green-700">{fmt(summary.current)}</td>
                <td className="px-4 py-3 text-right text-yellow-700">{fmt(summary['1_30'])}</td>
                <td className="px-4 py-3 text-right text-orange-600">{fmt(summary['31_60'])}</td>
                <td className="px-4 py-3 text-right text-red-600">{fmt(summary['61_90'])}</td>
                <td className="px-4 py-3 text-right text-red-800">{fmt(summary['90_plus'])}</td>
                <td className="px-4 py-3 text-right">{fmt(summary.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
