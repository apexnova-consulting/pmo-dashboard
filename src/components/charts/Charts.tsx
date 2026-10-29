import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeekPoint, WorkloadRow } from '@/domain/derive';
import { formatDay } from '@/domain/dates';
import { ChartFrame, SimpleTable } from '@/components/charts/ChartFrame';

function axisDate(value: string) {
  return formatDay(value, 'UTC').replace(/^[A-Za-z]+, /, '');
}

export function HealthTrend({ weeks }: { weeks: WeekPoint[] }) {
  const summary = weeks.length
    ? `Portfolio health over ${weeks.length} points. Latest: ${weeks.at(-1)?.red ?? 0} red, ${weeks.at(-1)?.amber ?? 0} amber, ${weeks.at(-1)?.green ?? 0} green.`
    : 'No health history yet.';
  return (
    <ChartFrame
      title="Portfolio health"
      summary={summary}
      table={
        <SimpleTable
          headers={['Week', 'Red', 'Amber', 'Green']}
          rows={weeks.map((week) => [
            axisDate(week.date),
            String(week.red),
            String(week.amber),
            String(week.green),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weeks}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={axisDate} stroke="var(--text-muted)" fontSize={12} />
          <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
          <Tooltip />
          <Legend />
          <Area
            dataKey="red"
            name="Red"
            stackId="rag"
            stroke="var(--rag-red)"
            fill="var(--rag-red)"
          />
          <Area
            dataKey="amber"
            name="Amber"
            stackId="rag"
            stroke="var(--rag-amber)"
            fill="var(--rag-amber)"
          />
          <Area
            dataKey="green"
            name="Green"
            stackId="rag"
            stroke="var(--rag-green)"
            fill="var(--rag-green)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function StatusDonut({
  counts,
}: {
  counts: { todo: number; in_progress: number; done: number };
}) {
  const data = [
    { name: 'To do', value: counts.todo, fill: 'var(--series-1)' },
    { name: 'In progress', value: counts.in_progress, fill: 'var(--series-2)' },
    { name: 'Done', value: counts.done, fill: 'var(--series-4)' },
  ];
  const summary = `Tickets by status. To do ${counts.todo}, in progress ${counts.in_progress}, done ${counts.done}.`;
  return (
    <ChartFrame
      title="Tickets by status"
      summary={summary}
      table={
        <SimpleTable
          headers={['Status', 'Tickets']}
          rows={data.map((item) => [item.name, String(item.value)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((item) => (
              <Cell key={item.name} fill={item.fill} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BurnChart({ weeks, netFlow }: { weeks: WeekPoint[]; netFlow: number | null }) {
  const latest = weeks.at(-1);
  const flow =
    netFlow == null
      ? 'n/a'
      : netFlow > 0
        ? `+${netFlow}, backlog grew`
        : netFlow < 0
          ? `${netFlow}, backlog shrank`
          : 'flat';
  const summary = latest
    ? `Created versus resolved by week. Latest week created ${latest.created}, resolved ${latest.resolved}. Net flow ${flow}.`
    : 'No weekly flow yet.';
  return (
    <ChartFrame
      title="Created vs resolved"
      summary={summary}
      table={
        <SimpleTable
          headers={['Week', 'Created', 'Resolved']}
          rows={weeks.map((week) => [
            axisDate(week.date),
            String(week.created),
            String(week.resolved),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={weeks}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={axisDate} stroke="var(--text-muted)" fontSize={12} />
          <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
          <Tooltip />
          <Legend />
          <Bar dataKey="created" name="Created" fill="var(--series-1)" />
          <Line
            dataKey="resolved"
            name="Resolved"
            stroke="var(--series-4)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function AgingChart({ rows }: { rows: { label: string; count: number }[] }) {
  const summary = `Open tickets by age. ${rows.map((row) => `${row.label} ${row.count}`).join(', ')}.`;
  return (
    <ChartFrame
      title="Aging"
      summary={summary}
      table={
        <SimpleTable
          headers={['Age', 'Open tickets']}
          rows={rows.map((row) => [row.label, String(row.count)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} />
          <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
          <Tooltip />
          <Bar dataKey="count" name="Open tickets" fill="var(--series-1)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function OverdueBars({ rows }: { rows: { name: string; count: number }[] }) {
  const summary = rows.length
    ? `Overdue tickets by project. ${rows.map((row) => `${row.name} ${row.count}`).join(', ')}.`
    : 'No overdue tickets.';
  return (
    <ChartFrame
      title="Overdue by project"
      summary={summary}
      table={
        <SimpleTable
          headers={['Project', 'Overdue']}
          rows={rows.map((row) => [row.name, String(row.count)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            stroke="var(--text-muted)"
            fontSize={12}
          />
          <Tooltip />
          <Bar dataKey="count" name="Overdue" fill="var(--rag-red)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function WorkloadChart({ rows }: { rows: WorkloadRow[] }) {
  const data = rows.map((row) => ({
    name: row.name,
    Highest: row.byPriority.highest,
    High: row.byPriority.high,
    Medium: row.byPriority.medium,
    Low: row.byPriority.low,
    Lowest: row.byPriority.lowest,
    Overdue: row.overdue,
    Capacity: row.weeklyCapacity,
  }));
  const summary = `Open tickets by person and priority. ${rows.map((row) => `${row.name} ${row.open} open, ${row.overdue} overdue`).join('. ')}.`;
  return (
    <ChartFrame
      title="Open work by priority"
      summary={summary}
      table={
        <SimpleTable
          headers={['Person', 'Open', 'Overdue', 'Capacity']}
          rows={rows.map((row) => [
            row.name,
            String(row.open),
            String(row.overdue),
            row.weeklyCapacity == null ? 'n/a' : String(row.weeklyCapacity),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            stroke="var(--text-muted)"
            fontSize={12}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey="Highest" stackId="open" fill="var(--series-5)" />
          <Bar dataKey="High" stackId="open" fill="var(--series-2)" />
          <Bar dataKey="Medium" stackId="open" fill="var(--series-1)" />
          <Bar dataKey="Low" stackId="open" fill="var(--series-6)" />
          <Bar dataKey="Lowest" stackId="open" fill="var(--series-neutral)" />
          <Bar dataKey="Overdue" fill="var(--rag-red)" />
          <Scatter dataKey="Capacity" name="Weekly capacity" fill="var(--brand-purple-strong)" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BurnupChart({
  points,
}: {
  points: { date: string; scope: number; completed: number }[];
}) {
  const summary = points.length
    ? `Scope versus completed. Latest scope ${points.at(-1)?.scope ?? 0}, completed ${points.at(-1)?.completed ?? 0}.`
    : 'Not enough ticket history for a burnup.';
  return (
    <ChartFrame
      title="Burnup"
      summary={summary}
      table={
        <SimpleTable
          headers={['Week', 'Scope', 'Completed']}
          rows={points.map((point) => [
            axisDate(point.date),
            String(point.scope),
            String(point.completed),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={axisDate} stroke="var(--text-muted)" fontSize={12} />
          <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
          <Tooltip />
          <Legend />
          <Line dataKey="scope" name="Scope" stroke="var(--series-2)" strokeWidth={2} dot={false} />
          <Line
            dataKey="completed"
            name="Completed"
            stroke="var(--series-4)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
