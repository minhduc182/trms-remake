import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { getActiveUsername, isUserLoggedIn } from './lib/graphql';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { ShiftsPage } from './pages/ShiftsPage';
import { RequestsPage } from './pages/RequestsPage';
import { DispatchPage } from './pages/DispatchPage';
import { TripsAndVehicleOpsPage } from './pages/TripsAndVehicleOpsPage';
import { DriverPage } from './pages/DriverPage';
import { CostReportsPage } from './pages/CostReportsPage';
import { AuditAndSettingsPage } from './pages/AuditAndSettingsPage';

export function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => isUserLoggedIn());
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/dashboard';
    const p = window.location.pathname;
    return p === '/' || p === '/login' || !p ? '/dashboard' : p;
  });

  const [roleVersion, setRoleVersion] = useState<string>(() => getActiveUsername());

  const handleNavigate = (nextPath: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentPath(nextPath);
  };

  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname;
      setLoggedIn(isUserLoggedIn());
      setCurrentPath(p === '/' || p === '/login' || !p ? '/dashboard' : p);
    };

    const onRoleChanged = (ev: Event) => {
      const customEv = ev as CustomEvent<{ username: string }>;
      const nextUser = customEv.detail?.username || getActiveUsername();
      setLoggedIn(isUserLoggedIn());
      setRoleVersion(nextUser);
      if (nextUser === 'test_driver') {
        handleNavigate('/driver');
      }
    };

    const onAuthChanged = () => {
      setLoggedIn(isUserLoggedIn());
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('trms-role-changed', onRoleChanged);
    window.addEventListener('trms-auth-changed', onAuthChanged);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('trms-role-changed', onRoleChanged);
      window.removeEventListener('trms-auth-changed', onAuthChanged);
    };
  }, []);

  if (!loggedIn) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          setLoggedIn(true);
          setRoleVersion(getActiveUsername());
          handleNavigate('/dashboard');
        }}
      />
    );
  }

  const renderPage = () => {
    if (currentPath.startsWith('/master-data')) {
      return <MasterDataPage />;
    }
    if (currentPath.startsWith('/shifts')) {
      return <ShiftsPage />;
    }
    if (currentPath.startsWith('/requests')) {
      return <RequestsPage />;
    }
    if (currentPath.startsWith('/dispatch')) {
      return <DispatchPage />;
    }
    if (currentPath.startsWith('/trips')) {
      return <TripsAndVehicleOpsPage initialView="TRIPS" />;
    }
    if (currentPath.startsWith('/vehicle-ops')) {
      return <TripsAndVehicleOpsPage initialView="VEHICLE_OPS" />;
    }
    if (currentPath.startsWith('/driver')) {
      return <DriverPage />;
    }
    if (currentPath.startsWith('/cost-reports')) {
      return <CostReportsPage initialTab="VEHICLE_BILL" />;
    }
    if (currentPath.startsWith('/etp-reports')) {
      return <CostReportsPage initialTab="ETP_REPORT" />;
    }
    if (currentPath.startsWith('/audit-logs')) {
      return <AuditAndSettingsPage initialView="AUDIT" />;
    }
    if (currentPath.startsWith('/settings')) {
      return <AuditAndSettingsPage initialView="SETTINGS" />;
    }
    return <DashboardPage onNavigate={handleNavigate} />;
  };

  return (
    <Layout currentPath={currentPath} onNavigate={handleNavigate}>
      <div key={roleVersion}>{renderPage()}</div>
    </Layout>
  );
}

export default App;
