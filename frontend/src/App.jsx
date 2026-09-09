import { Routes, Route, Link, Navigate } from 'react-router-dom';
import TripListPage from './pages/TripListPage.jsx';
import TripDetailPage from './pages/TripDetailPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';

export default function App() {
  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          ✈️ Trip Planner
        </Link>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<TripListPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/trips/:id/budget" element={<BudgetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
