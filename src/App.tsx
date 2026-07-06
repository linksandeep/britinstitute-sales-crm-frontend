import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import RestrictedPopup from './components/RestrictedAccess';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calls = lazy(() => import('./pages/Calls'));
const AllLeads = lazy(() => import('./pages/AllLeads'));
const MyLeads = lazy(() => import('./pages/MyLeads'));
const AddLead = lazy(() => import('./pages/AddLead'));
const SmartImportLeads = lazy(() => import('./pages/SmartImportLeads'));
const LeadDetails = lazy(() => import('./pages/LeadDetails'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const StatusManagement = lazy(() => import('./pages/StatusManagement'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const WhatsAppChatUI = lazy(() => import('./pages/whatsapp'));
const AttendanceReport = lazy(() => import('./pages/AttendanceManagement'));

const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading workspace' }) => (
  <div className="app-loading">
    <div className="app-loading__panel">
      <div className="loading-spinner" />
      {label}
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const ProtectedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const NotFound: React.FC = () => (
  <div className="card mx-auto max-w-lg">
    <div className="card-body text-center">
      <h1 className="text-2xl font-extrabold text-gray-900">Page Not Found</h1>
      <p className="mt-2 text-gray-600">The requested CRM page does not exist.</p>
      <a href="/dashboard" className="btn btn-primary mt-5">
        Go to Dashboard
      </a>
    </div>
  </div>
);

const AppRoutes: React.FC = () => (
  <Suspense fallback={<LoadingScreen label="Loading module" />}>
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedPage>
            <Dashboard />
          </ProtectedPage>
        }
      />
      <Route
        path="/calls"
        element={
          <ProtectedPage>
            <Calls />
          </ProtectedPage>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedPage>
            <AllLeads />
          </ProtectedPage>
        }
      />
      <Route
        path="/my-leads"
        element={
          <ProtectedPage>
            <MyLeads />
          </ProtectedPage>
        }
      />
      <Route
        path="/leads/new"
        element={
          <ProtectedPage>
            <AddLead />
          </ProtectedPage>
        }
      />
      <Route
        path="/leads/import"
        element={
          <ProtectedPage>
            <SmartImportLeads />
          </ProtectedPage>
        }
      />
      <Route
        path="/leads/import/smart"
        element={
          <ProtectedPage>
            <SmartImportLeads />
          </ProtectedPage>
        }
      />
      <Route
        path="/leads/assign"
        element={<Navigate to="/leads" replace />}
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedPage>
            <LeadDetails />
          </ProtectedPage>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedPage>
            <UserManagement />
          </ProtectedPage>
        }
      />
      <Route
        path="/statuses"
        element={
          <ProtectedPage>
            <StatusManagement />
          </ProtectedPage>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedPage>
            <Analytics />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedPage>
            <Settings />
          </ProtectedPage>
        }
      />
      <Route
        path="/WhatsAppChat"
        element={
          <ProtectedPage>
            <WhatsAppChatUI />
          </ProtectedPage>
        }
      />
      <Route
        path="/attendance-management"
        element={
          <ProtectedPage>
            <AttendanceReport />
          </ProtectedPage>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="*"
        element={
          <ProtectedPage>
            <NotFound />
          </ProtectedPage>
        }
      />
    </Routes>
  </Suspense>
);

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <AppRoutes />
      <RestrictedPopup />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#111827',
            color: '#fff',
            borderRadius: '8px'
          },
          success: {
            style: {
              background: '#047857'
            }
          },
          error: {
            style: {
              background: '#be123c'
            }
          }
        }}
      />
    </Router>
  </AuthProvider>
);

export default App;
