import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID_TP;

export default function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  const handleSuccess = async (resp) => {
    setError(null);
    setBusy(true);
    try {
      await login(resp.credential);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-center pt-16 px-4">
      <div className="card max-w-[380px] w-full text-center">
        <h1 className="text-[20px] font-bold mb-1 flex items-center justify-center gap-2">
          <span className="msi text-secondary text-[28px]">travel_explore</span>
          Trip Planner
        </h1>
        <p className="muted mt-0 mb-4">Entrá con tu cuenta de Google habilitada.</p>

        {error && <div className="alert alert-error">{error}</div>}

        {!CLIENT_ID ? (
          <div className="alert alert-warning">
            Falta configurar <code>VITE_GOOGLE_CLIENT_ID_TP</code>.
          </div>
        ) : busy ? (
          <p className="muted">Verificando…</p>
        ) : (
          <div className="flex justify-center">
            <GoogleLogin onSuccess={handleSuccess} onError={() => setError('No se pudo iniciar sesión con Google')} />
          </div>
        )}
      </div>
    </div>
  );
}
