import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { AppLayout } from '@/layouts/app-layout';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import DocumentsPage from '@/pages/documents';
import ProfilePage from '@/pages/profile';
import JobPostingsPage from '@/pages/job-postings';
import JobPostingNewPage from '@/pages/job-posting-new';
import JobPostingEditPage from '@/pages/job-posting-edit';
import SitesPage from '@/pages/sites';
import ResumesPage from '@/pages/resumes';
import SettingsPage from '@/pages/settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="documents" replace />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="job-postings" element={<JobPostingsPage />} />
        <Route path="job-postings/new" element={<JobPostingNewPage />} />
        <Route path="job-postings/:id" element={<JobPostingEditPage />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="resumes" element={<ResumesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
