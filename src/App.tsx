import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import SettingsPage from '@/pages/SettingsPage';
import DemoDataPage from '@/pages/DemoDataPage';
import DashboardPage from '@/pages/DashboardPage';
import LeadsListPage from '@/pages/LeadsListPage';
import LeadDetailPage from '@/pages/LeadDetailPage';
import AppointmentsPage from '@/pages/AppointmentsPage';
import EventsPage from '@/pages/EventsPage';

export default function App() {
  return (
    <AuthProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/leads"
            element={
              <ProtectedRoute>
                <LeadsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/leads/:id"
            element={
              <ProtectedRoute>
                <LeadDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/appointments"
            element={
              <ProtectedRoute>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/events"
            element={
              <ProtectedRoute>
                <EventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/demo"
            element={
              <ProtectedRoute>
                <DemoDataPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </AppLayout>
    </AuthProvider>
  );
}
