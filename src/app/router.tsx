import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/common/States';

const OverviewPage = lazy(() => import('@/features/overview/OverviewPage'));
const MyWorkPage = lazy(() => import('@/features/my-work/MyWorkPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage'));
const TicketsPage = lazy(() => import('@/features/tickets/TicketsPage'));
const RisksPage = lazy(() => import('@/features/risks/RisksPage'));
const WorkloadPage = lazy(() => import('@/features/workload/WorkloadPage'));
const AboutPage = lazy(() => import('@/features/about/AboutPage'));
const NotFoundPage = lazy(() => import('@/features/not-found/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <PageSkeleton />
        </div>
      }
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="my-work" element={<MyWorkPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:key" element={<ProjectDetailPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="risks" element={<RisksPage />} />
          <Route path="workload" element={<WorkloadPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
