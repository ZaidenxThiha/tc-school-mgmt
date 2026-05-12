'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

type Row = { month: string; income: number; expense: number; net: number };

const fmt = new Intl.NumberFormat('en-US');

export default function PLChart({ data }: { data: Row[] }) {
  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(v / 1_000_000) + 'M'} />
          <Tooltip
            formatter={(v: number) => fmt.format(v) + ' MMK'}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="net" name="Net" stroke="#4f6df5" strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
