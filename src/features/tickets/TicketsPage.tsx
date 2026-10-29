import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { ExternalAnchor, PriorityBadge, StatusLabel } from '@/components/common/Badges';
import { Drawer, Modal } from '@/components/ui/dialog';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';
import { toCsv } from '@/domain/csv';
import { formatDay } from '@/domain/dates';
import { jiraUrl, type EnrichedTicket } from '@/domain/derive';
import { useScopedHref } from '@/hooks/useFilters';
import { useDensity, useMediaQuery } from '@/hooks/useTheme';
import { downloadText } from '@/lib/utils';

const COLUMN_KEY = 'pmo-ticket-columns';
const VIEWS_KEY = 'pmo-ticket-views';

const ALL_COLUMNS = [
  'key',
  'type',
  'summary',
  'project',
  'assignee',
  'status',
  'priority',
  'due',
  'created',
  'updated',
  'age',
  'flags',
] as const;

type ColId = (typeof ALL_COLUMNS)[number];

function loadColumns(): ColId[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COLUMN_KEY) || 'null') as unknown;
    if (!Array.isArray(raw)) return [...ALL_COLUMNS];
    const allowed = raw.filter((item): item is ColId => ALL_COLUMNS.includes(item as ColId));
    return allowed.length ? allowed : [...ALL_COLUMNS];
  } catch {
    return [...ALL_COLUMNS];
  }
}

export default function TicketsPage() {
  const dash = useOutletContext<DashContext>();
  const href = useScopedHref();
  const [params, setParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'age', desc: true }]);
  const [columns, setColumns] = useState<ColId[]>(loadColumns);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [views, setViews] = useState<{ name: string; query: string }[]>(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(VIEWS_KEY) || '[]') as {
        name: string;
        query: string;
      }[];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const narrow = useMediaQuery('(max-width: 767px)');
  const { density, toggle } = useDensity();
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    if (!dash.model) return [];
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const projects = (params.get('project') ?? '').split(',').filter(Boolean);
    const statuses = (params.get('status') ?? '').split(',').filter(Boolean);
    const priorities = (params.get('priority') ?? '').split(',').filter(Boolean);
    const types = (params.get('type') ?? '').split(',').filter(Boolean);
    const assignees = (params.get('assignee') ?? '').split(',').filter(Boolean);
    const labels = (params.get('label') ?? '').split(',').filter(Boolean);
    const chip = params.get('chip');
    return dash.model.tickets.filter((item) => {
      if (q && !`${item.ticket.key} ${item.ticket.summary}`.toLowerCase().includes(q)) return false;
      if (projects.length && !projects.includes(item.ticket.projectKey)) return false;
      if (statuses.length && !statuses.includes(item.ticket.statusCategory)) return false;
      if (priorities.length && !priorities.includes(item.ticket.priority)) return false;
      if (types.length && !types.includes(item.ticket.type)) return false;
      if (assignees.length) {
        const id = item.ticket.assigneeId ?? 'unassigned';
        if (!assignees.includes(id)) return false;
      }
      if (labels.length && !labels.some((label) => item.ticket.labels.includes(label)))
        return false;
      if (chip === 'overdue' && !item.overdue) return false;
      if (chip === 'week' && !item.dueSoon) return false;
      if (chip === 'blocked' && !item.blocked) return false;
      if (chip === 'unassigned' && item.ticket.assigneeId != null) return false;
      if (chip === 'stale' && !item.stale) return false;
      return true;
    });
  }, [dash.model, params]);

  const selected = rows.find((item) => item.ticket.key === params.get('ticket')) ?? null;

  const defs = useMemo<ColumnDef<EnrichedTicket>[]>(() => {
    const model = dash.model;
    if (!model) return [];
    const all: Record<ColId, ColumnDef<EnrichedTicket>> = {
      key: {
        id: 'key',
        header: 'Key',
        accessorFn: (row) => row.ticket.key,
        cell: ({ row }) => (
          <ExternalAnchor
            className="font-bold"
            href={jiraUrl(model.jiraBaseUrl, row.original.ticket.key, row.original.ticket.url)}
            onClick={(event) => event.stopPropagation()}
          >
            {row.original.ticket.key}
          </ExternalAnchor>
        ),
      },
      type: { id: 'type', header: 'Type', accessorFn: (row) => row.ticket.type },
      summary: { id: 'summary', header: 'Summary', accessorFn: (row) => row.ticket.summary },
      project: { id: 'project', header: 'Project', accessorFn: (row) => row.projectName },
      assignee: {
        id: 'assignee',
        header: 'Assignee',
        accessorFn: (row) => row.assignee?.displayName ?? 'Unassigned',
      },
      status: {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.ticket.statusName,
        cell: ({ row }) => (
          <StatusLabel
            name={row.original.ticket.statusName}
            category={row.original.ticket.statusCategory}
          />
        ),
      },
      priority: {
        id: 'priority',
        header: 'Priority',
        accessorFn: (row) => row.ticket.priority,
        cell: ({ row }) => <PriorityBadge priority={row.original.ticket.priority} />,
      },
      due: { id: 'due', header: 'Due', accessorFn: (row) => row.ticket.dueDate ?? '' },
      created: { id: 'created', header: 'Created', accessorFn: (row) => row.ticket.created },
      updated: { id: 'updated', header: 'Updated', accessorFn: (row) => row.ticket.updated },
      age: { id: 'age', header: 'Age', accessorFn: (row) => row.ageDays },
      flags: {
        id: 'flags',
        header: 'Flags',
        accessorFn: (row) =>
          `${row.blocked ? 'blocked' : ''} ${row.overdue ? 'overdue' : ''} ${row.stale ? 'stale' : ''}`.trim(),
      },
    };
    return columns.map((id) => all[id]);
  }, [columns, dash.model]);

  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const tableRows = table.getRowModel().rows;
  const virtual = tableRows.length > 200;
  const virtualizer = useVirtualizer({
    count: virtual ? tableRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (density === 'compact' ? 40 : 56),
    overscan: 10,
  });

  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model) return <EmptyState title="No tickets" body="The snapshot did not load." />;
  if (dash.model.mode === 'portfolio') {
    return (
      <EmptyState
        title="No tickets in this snapshot"
        body="Status updates live on the Updates page. Ticket tools appear when a snapshot includes tickets."
        actionHref={href('/updates')}
        actionLabel="Open updates"
      />
    );
  }

  const setParam = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const toggleList = (key: string, value: string) => {
    const current = (params.get(key) ?? '').split(',').filter(Boolean);
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setParam(key, next.join(','));
  };
  const openTicket = (key: string) => setParam('ticket', key);
  const exportCsv = () => {
    const header = [
      'Key',
      'Type',
      'Summary',
      'Project',
      'Assignee',
      'Status',
      'Priority',
      'Due',
      'Age',
      'Flags',
    ];
    const body = tableRows.map((row) => {
      const item = row.original;
      return [
        item.ticket.key,
        item.ticket.type,
        item.ticket.summary,
        item.projectName,
        item.assignee?.displayName ?? 'Unassigned',
        item.ticket.statusName,
        item.ticket.priority,
        item.ticket.dueDate ?? '',
        String(item.ageDays),
        [item.blocked ? 'blocked' : '', item.overdue ? 'overdue' : '', item.stale ? 'stale' : '']
          .filter(Boolean)
          .join(' '),
      ];
    });
    downloadText('pmo-tickets.csv', toCsv([header, ...body]));
  };
  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    const query = params.toString();
    const next = [...views.filter((view) => view.name !== name), { name, query }];
    setViews(next);
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    setSaveOpen(false);
    setViewName('');
  };

  const chips = [
    ['overdue', 'Overdue'],
    ['week', 'Due this week'],
    ['blocked', 'Blocked'],
    ['unassigned', 'Unassigned'],
    ['stale', 'Stale'],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Tickets & Tasks"
        lede={`${rows.length} tickets in this view. Search, chips, and the owner filter can be shared from the address bar.`}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Search key or summary
          <input
            value={params.get('q') ?? ''}
            onChange={(event) => setParam('q', event.target.value)}
            className="mt-1 block w-64 rounded-md border border-line bg-sunken px-3 py-2"
          />
        </label>
        <FilterMenu
          label="Project"
          values={dash.model.projects.map((project) => project.project.key)}
          selected={(params.get('project') ?? '').split(',').filter(Boolean)}
          onToggle={(value) => toggleList('project', value)}
        />
        <FilterMenu
          label="Status"
          values={['todo', 'in_progress', 'done']}
          selected={(params.get('status') ?? '').split(',').filter(Boolean)}
          onToggle={(value) => toggleList('status', value)}
        />
        <FilterMenu
          label="Priority"
          values={['highest', 'high', 'medium', 'low', 'lowest']}
          selected={(params.get('priority') ?? '').split(',').filter(Boolean)}
          onToggle={(value) => toggleList('priority', value)}
        />
        <button type="button" className="link text-sm font-bold" onClick={toggle}>
          {density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
        </button>
        <button type="button" className="link text-sm font-bold" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" className="link text-sm font-bold" onClick={() => setSaveOpen(true)}>
          Save view
        </button>
        {views.length > 0 ? (
          <label className="text-sm">
            Saved views
            <select
              className="mt-1 block rounded-md border border-line bg-card px-2 py-2"
              value=""
              onChange={(event) => {
                const view = views.find((item) => item.name === event.target.value);
                if (!view) return;
                setParams(new URLSearchParams(view.query));
              }}
            >
              <option value="">Choose</option>
              {views.map((view) => (
                <option key={view.name} value={view.name}>
                  {view.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-brand-strong">Columns</summary>
          <fieldset className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-line bg-card p-2">
            <legend className="sr-only">Visible columns</legend>
            {ALL_COLUMNS.map((id) => (
              <label key={id} className="flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={columns.includes(id)}
                  onChange={() => {
                    const next = columns.includes(id)
                      ? columns.filter((item) => item !== id)
                      : [...columns, id];
                    const ordered = ALL_COLUMNS.filter((item) => next.includes(item));
                    setColumns([...ordered]);
                    window.localStorage.setItem(COLUMN_KEY, JSON.stringify(ordered));
                  }}
                />
                {id}
              </label>
            ))}
          </fieldset>
        </details>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={params.get('chip') === id}
            className={
              params.get('chip') === id
                ? 'rounded-full bg-brand-tint px-3 py-1 text-sm font-bold text-brand-strong underline'
                : 'rounded-full border border-line px-3 py-1 text-sm'
            }
            onClick={() => setParam('chip', params.get('chip') === id ? '' : id)}
          >
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No tickets match"
          body="Clear the search or chips to see the rest of this owner’s work."
        />
      ) : narrow ? (
        <ul className="space-y-3">
          {tableRows.slice(0, virtual ? 80 : tableRows.length).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full rounded-[12px] border border-line bg-card p-4 text-left"
                onClick={() => openTicket(row.original.ticket.key)}
              >
                <span className="link font-bold">{row.original.ticket.key}</span>
                <span className="mt-1 block">{row.original.ticket.summary}</span>
                <span className="mt-1 block text-sm text-muted">
                  {row.original.projectName} · {row.original.assignee?.displayName ?? 'Unassigned'}{' '}
                  · {row.original.ageDays} days
                </span>
              </button>
            </li>
          ))}
          {virtual ? (
            <li className="text-sm text-muted">
              Showing the first 80 cards. Search to narrow a large list.
            </li>
          ) : null}
        </ul>
      ) : (
        <div
          ref={parentRef}
          className="max-h-[70vh] overflow-auto rounded-[12px] border border-line bg-card"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {rows.length} tickets. Activate a row for details. The key opens the tracker when a
              link is present.
            </caption>
            <thead className="sticky top-0 bg-sunken">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                      className="px-3 py-2 font-bold tracking-[0.04em]"
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="sr-only">
                          {header.column.getIsSorted()
                            ? `sorted ${header.column.getIsSorted()}`
                            : 'sortable'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody
              style={
                virtual ? { height: virtualizer.getTotalSize(), position: 'relative' } : undefined
              }
            >
              {(virtual
                ? virtualizer.getVirtualItems()
                : tableRows.map((_, index) => ({ index, start: 0, key: index }))
              ).map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                if (!row) return null;
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-line hover:bg-brand-tint"
                    style={
                      virtual
                        ? {
                            position: 'absolute',
                            transform: `translateY(${virtualRow.start}px)`,
                            width: '100%',
                          }
                        : undefined
                    }
                    tabIndex={0}
                    onClick={() => openTicket(row.original.ticket.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openTicket(row.original.ticket.key);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={density === 'compact' ? 'px-3 py-1' : 'px-3 py-3'}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setParam('ticket', '');
        }}
        title={selected?.ticket.key ?? 'Ticket'}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <p>{selected.ticket.summary}</p>
            <p>
              <span className="font-bold">Project. </span>
              {selected.projectName}
            </p>
            <p>
              <span className="font-bold">Assignee. </span>
              {selected.assignee?.displayName ?? 'Unassigned'}
            </p>
            <p>
              <span className="font-bold">Status. </span>
              {selected.ticket.statusName}
            </p>
            <p>
              <span className="font-bold">Priority. </span>
              {selected.ticket.priority}
            </p>
            <p>
              <span className="font-bold">Due. </span>
              {selected.ticket.dueDate ? formatDay(selected.ticket.dueDate, 'UTC') : 'n/a'}
            </p>
            <p>
              <span className="font-bold">Age. </span>
              {selected.ageDays} days
            </p>
            <p>
              <span className="font-bold">Labels. </span>
              {selected.ticket.labels.length ? selected.ticket.labels.join(', ') : 'None'}
            </p>
            <p className="text-muted">
              This snapshot did not include a description or comment history.
            </p>
            <ExternalAnchor
              className="font-bold"
              href={jiraUrl(dash.model.jiraBaseUrl, selected.ticket.key, selected.ticket.url)}
            >
              {jiraUrl(dash.model.jiraBaseUrl, selected.ticket.key, selected.ticket.url)
                ? 'Open in tracker'
                : 'No tracker link'}
            </ExternalAnchor>
          </div>
        ) : null}
      </Drawer>
      <Modal open={saveOpen} onOpenChange={setSaveOpen} title="Save this view">
        <label className="block text-sm">
          Name
          <input
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-sunken px-3 py-2"
          />
        </label>
        <button
          type="button"
          className="mt-4 rounded-full bg-brand px-4 py-2 font-bold text-on-brand"
          onClick={saveView}
        >
          Save
        </button>
      </Modal>
    </div>
  );
}

function FilterMenu({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer rounded-md border border-line bg-card px-3 py-2 font-bold">
        {label}
        {selected.length ? ` (${selected.length})` : ''}
      </summary>
      <fieldset className="absolute z-10 mt-1 max-h-56 overflow-auto rounded-md border border-line bg-card p-2">
        <legend className="sr-only">{label}</legend>
        {values.map((value) => (
          <label key={value} className="flex items-center gap-2 py-1 capitalize">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
            />
            {value.replaceAll('_', ' ')}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
