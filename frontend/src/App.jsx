import { Routes, Route, Link, Navigate } from 'react-router-dom';
import TripListPage from './pages/TripListPage.jsx';
import TripDetailPage from './pages/TripDetailPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';
import AccommodationsPage from './pages/AccommodationsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { useAuth } from './context/AuthContext.jsx';

function HeaderUser() {
  const { status, user, logout } = useAuth();
  if (status !== 'authenticated') return null;
  return (
    <div className="header-user">
      {user?.picture && <img src={user.picture} alt="" className="avatar" referrerPolicy="no-referrer" />}
      <span className="muted">{user?.name || user?.email}</span>
      <button className="btn-link" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <header className="app-header row-between">
        <Link to="/" className="brand">
          ✈️ Trip Planner
        </Link>
        <HeaderUser />
      </header>
      <main className="container">
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
