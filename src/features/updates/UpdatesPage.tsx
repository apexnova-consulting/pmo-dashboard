import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { RiskLevelBadge, SourceBadge } from '@/components/common/Badges';
import { PageHeader } from '@/components/common/States';
import { Drawer } from '@/components/ui/dialog';
import { toCsv } from '@/domain/csv';
import { formatDay } from '@/domain/dates';
import type { EnrichedUpdate } from '@/domain/derive';
import { downloadText } from '@/lib/utils';

export function UpdatesPage({ dash }: { dash: DashContext }) {
  const model = dash.model;
  const [params, setParams] = useSearchParams();
  const rows = useMemo(() => {
    if (!model) return [];
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const project = params.get('project') ?? '';
    const person = params.get('person') ?? '';
    const type = params.get('type') ?? '';
    const source = params.get('source') ?? '';
    const level = params.get('level') ?? '';
    const blocked = params.get('blocked') ?? '';
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    return model.updates.filter((item) => {
      if (project && item.update.projectKey !== project) return false;
      if (type && item.update.type !== type) return false;
      if (source && item.update.source !== source) return false;
      if (level && item.update.riskLevel !== level) return false;
      if (blocked === 'yes' && !item.update.blocked) return false;
      if (blocked === 'no' && item.update.blocked) return false;
      if (from && item.update.date < from) return false;
      if (to && item.update.date > to) return false;
      if (person) {
        const matches =
          item.update.authorId === person ||
          item.update.ownerId === person ||
          (person === 'unassigned' &&
            (item.update.authorId == null || item.update.ownerId == null));
        if (!matches) return false;
      }
      if (
        q &&
        !`${item.update.title} ${item.update.summary} ${item.projectName}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [model, params]);
  if (!model) return null;
  const selected = rows.find((item) => item.update.id === params.get('update')) ?? null;
  const set = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const exportCsv = () => {
    const table = [
      [
        'Date',
        'Project',
        'Type',
        'Title',
        'Author',
        'Source',
        'Risk level',
        'Blocked',
        'Status',
        'Summary',
      ],
      ...rows.map((item) => [
        item.update.date,
        item.projectName,
        item.update.type,
        item.update.title,
        item.author?.displayName ?? item.update.authorName ?? '',
        item.update.source,
        item.update.riskLevel ?? '',
        item.update.blocked ? 'yes' : 'no',
        item.update.status,
        item.update.summary,
      ]),
    ];
    downloadText('pmo-updates.csv', toCsv(table));
  };
  return (
    <div>
      <PageHeader
        title="Updates"
        lede="Status notes from the project list and from tagged mailbox messages. The text is shown as written."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Search
          <input
            value={params.get('q') ?? ''}
            onChange={(event) => set('q', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-sunken px-3 py-2"
          />
        </label>
        <Select
          label="Project"
          value={params.get('project') ?? ''}
          onChange={(value) => set('project', value)}
        >
          <option value="">Any</option>
          {model.projects.map((project) => (
            <option key={project.project.key} value={project.project.key}>
              {project.project.name}
            </option>
          ))}
        </Select>
        <Select
          label="Person"
          value={params.get('person') ?? ''}
          onChange={(value) => set('person', value)}
        >
          <option value="">Any</option>
          {model.team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
          <option value="unassigned">Unassigned</option>
        </Select>
        <Select
          label="Type"
          value={params.get('type') ?? ''}
          onChange={(value) => set('type', value)}
        >
          <option value="">Any</option>
          {['update', 'risk', 'decision', 'action'].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <Select
          label="Source"
          value={params.get('source') ?? ''}
          onChange={(value) => set('source', value)}
        >
          <option value="">Any</option>
          <option value="list">List</option>
          <option value="email">Email</option>
        </Select>
        <Select
          label="Risk level"
          value={params.get('level') ?? ''}
          onChange={(value) => set('level', value)}
        >
          <option value="">Any</option>
          {['low', 'medium', 'high', 'critical'].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
        <Select
          label="Blocked"
          value={params.get('blocked') ?? ''}
          onChange={(value) => set('blocked', value)}
        >
          <option value="">Any</option>
          <option value="yes">Blocked</option>
          <option value="no">Not blocked</option>
        </Select>
        <label className="text-sm">
          From
          <input
            type="date"
            value={params.get('from') ?? ''}
            onChange={(event) => set('from', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            value={params.get('to') ?? ''}
            onChange={(event) => set('to', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
          />
        </label>
        <button type="button" className="link text-sm font-bold" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <p className="mb-3 text-sm text-muted">{rows.length} updates</p>
      {rows.length === 0 ? (
        <p className="text-muted">No updates match these filters.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[12px] border border-line bg-card">
          {rows.map((item) => (
            <li key={item.update.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                className="flex flex-1 flex-wrap items-center gap-3 text-left"
                onClick={() => set('update', item.update.id)}
              >
                <span className="font-bold">{item.update.title}</span>
                <span className="text-sm text-muted">{item.projectName}</span>
                <span className="text-sm">{formatDay(item.update.date, model.timeZone)}</span>
                <span className="text-sm">
                  {item.author?.displayName ?? item.update.authorName ?? 'Unknown'}
                </span>
                {item.update.blocked ? <span className="text-sm font-bold">Blocked</span> : null}
              </button>
              <SourceBadge source={item.update.source} href={item.update.sourceUrl} />
              {item.update.riskLevel ? <RiskLevelBadge level={item.update.riskLevel} /> : null}
            </li>
          ))}
        </ul>
      )}
      <UpdateDrawer item={selected} timeZone={model.timeZone} onClose={() => set('update', '')} />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
      >
        {children}
      </select>
    </label>
  );
}

function UpdateDrawer({
  item,
  timeZone,
  onClose,
}: {
  item: EnrichedUpdate | null;
  timeZone: string;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={item != null}
      onOpenChange={(open) => !open && onClose()}
      title={item?.update.title ?? 'Update'}
    >
      {item ? (
        <div className="space-y-3 text-sm">
          <p>
            {item.projectName} · {formatDay(item.update.date, timeZone)} ·{' '}
            {item.author?.displayName ?? item.update.authorName ?? 'Unknown author'}
          </p>
          <p className="flex flex-wrap gap-3">
            <SourceBadge source={item.update.source} href={item.update.sourceUrl} />
            {item.update.riskLevel ? <RiskLevelBadge level={item.update.riskLevel} /> : null}
            <span>{item.update.blocked ? 'Blocked' : 'Not blocked'}</span>
            <span>{item.update.status === 'open' ? 'Open' : 'Resolved'}</span>
          </p>
          <p className="whitespace-pre-wrap">{item.update.summary}</p>
          {item.update.mitigation ? (
            <p className="whitespace-pre-wrap">
              <span className="font-bold">Mitigation. </span>
              {item.update.mitigation}
            </p>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
