import { useState, type ReactNode } from 'react';

export function ChartFrame({
  title,
  summary,
  table,
  children,
}: {
  title: string;
  summary: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-[12px] border border-line bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="section-title flex-1 text-base">{title}</h2>
        <button
          type="button"
          className="link shrink-0 text-sm font-bold"
          onClick={() => setAsTable((value) => !value)}
          aria-pressed={asTable}
        >
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>
      <p className="sr-only">{summary}</p>
      {asTable ? (
        table
      ) : (
        <div className="h-72" role="img" aria-label={summary}>
          {children}
        </div>
      )}
    </section>
  );
}

export function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-sunken">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-bold tracking-[0.04em]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
