import { lazy, Suspense } from 'react';
import { Routes, Route, Link, Navigate, useMatch } from 'react-router-dom';
import TripListPage from './pages/TripListPage.jsx';
import TripDetailPage from './pages/TripDetailPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';
import AccommodationsPage from './pages/AccommodationsPage.jsx';
import DocumentosLinksPage from './pages/DocumentosLinksPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Spinner from './components/Spinner.jsx';
import TripTabs from './components/TripTabs.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Leaflet is heavy — keep it out of the main bundle.
const MapaLugaresPage = lazy(() => import('./pages/MapaLugaresPage.jsx'));
const DayRouteView = lazy(() => import('./pages/DayRouteView.jsx'));

function HeaderUser() {
  const { status, user, logout } = useAuth();
  if (status !== 'authenticated') return null;
  return (
    <div className="flex items-center gap-2.5">
      {user?.picture && (
        <img
          src={user.picture}
          alt=""
          className="w-6 h-6 rounded-full border border-outline-variant/30"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="muted hidden sm:inline">{user?.name || user?.email}</span>
      <button className="btn-link" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
}

function HeaderNav() {
  const match = useMatch('/trips/:id/*');
  if (!match) return null;
  return <TripTabs tripId={match.params.id} />;
}

export default function App() {
  return (
    <>
      <header className="bg-surface/90 backdrop-blur border-b border-outline-variant/30 sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <span className="msi text-secondary">travel_explore</span>
              <span className="font-semibold text-[15px]">Trip Planner</span>
            </Link>
            <div className="overflow-x-auto">
              <HeaderNav />
            </div>
          </div>
          <HeaderUser />
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <TripListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id"
            element={
              <RequireAuth>
                <TripDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id/budget"
            element={
              <RequireAuth>
                <BudgetPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id/alojamientos"
            element={
              <RequireAuth>
                <AccommodationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id/mapa"
            element={
              <RequireAuth>
                <Suspense fallback={<Spinner />}>
                  <MapaLugaresPage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id/documentos"
            element={
              <RequireAuth>
                <DocumentosLinksPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id/days/:dayId/route"
            element={
              <RequireAuth>
                <Suspense fallback={<Spinner />}>
                  <DayRouteView />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
