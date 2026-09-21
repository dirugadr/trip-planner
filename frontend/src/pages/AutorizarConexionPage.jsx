import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { approveMcpAuthorization, denyMcpAuthorization } from '../services/auth.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID_TP;
const PARAM_KEYS = ['client_id', 'redirect_uri', 'code_challenge', 'state', 'scope', 'resource'];

/** Display-only peek at the Google ID token (the server does the real verification). */
function peekGoogleUser(credential) {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: payload.email, name: payload.name };
  } catch {
    return {};
  }
}

/** Host shown to the user so they can tell where the approval will be sent.
 * Falls back to the raw value if it isn't a URL. */
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Consent screen for the MCP OAuth flow (HU-12.1, generalized in HU-12.4 for
 * any registered client such as Claude or ChatGPT). The backend's
 * /oauth/authorize sends the browser here; the traveler signs in with Google
 * (same allowlisted login as the web app) and explicitly approves. The backend
 * re-validates every parameter and only then returns the redirect back to the
 * client — this page never redirects anywhere it wasn't told to by the server.
 * `client_name` is display-only (the host the approval returns to is shown too,
 * since that is what can't be spoofed).
 */
export default function AutorizarConexionPage() {
  const [search] = useSearchParams();
  const appName = (search.get('client_name') || '').slice(0, 60) || 'Una aplicación';
  const params = useMemo(() => {
    const out = {};
    for (const key of PARAM_KEYS) if (search.get(key)) out[key] = search.get(key);
    return out;
  }, [search]);

  // HU-12.3: write access (scope mcp:write) is only granted if the traveler ticks the
  // box — never by default, never implied. The box is always offered: clients such as
  // Claude don't request mcp:write on their own, so gating it on the request left
  // no way to opt in.
  const [grantWrite, setGrantWrite] = useState(false);

  const [credential, setCredential] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const missing = !params.client_id || !params.redirect_uri || !params.code_challenge;
  const google = credential ? peekGoogleUser(credential) : null;

  const finish = async (request) => {
    setError(null);
    setBusy(true);
    try {
      const { redirect_url } = await request();
      window.location.assign(redirect_url);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-center pt-16 px-4">
      <div className="card max-w-[440px] w-full">
        <h1 className="text-[20px] font-bold mb-1 flex items-center justify-center gap-2">
          <span className="msi text-secondary text-[28px]">travel_explore</span>
          Conectar aplicación
        </h1>

        {missing ? (
          <div className="alert alert-error mt-4">
            Falta información de la solicitud de autorización. Volvé a iniciar la conexión desde la aplicación.
          </div>
        ) : (
          <>
            <p className="muted mt-2 mb-3 text-center">
              <strong>{appName}</strong> está pidiendo acceso a tu Trip Planner.
            </p>
            <ul className="text-[13px] mb-4 list-disc pl-5 space-y-1">
              <li>
                Podrá <strong>consultar</strong> tus viajes: itinerarios, presupuesto y gastos, alojamientos, lugares,
                documentos (sin descargarlos) y links.
              </li>
              {grantWrite ? (
                <li>
                  Además podrá <strong>crear y editar</strong> actividades, gastos y lugares (de a una cosa por vez).
                </li>
              ) : (
                <li>
                  <strong>No podrá</strong> crear ni editar nada.
                </li>
              )}
              <li>
                <strong>Nunca podrá eliminar</strong> nada.
              </li>
              <li>
                Al aprobar, volvés a <strong>{hostOf(params.redirect_uri)}</strong>. Podés revocar el acceso cuando quieras.
              </li>
            </ul>
            <label className="flex items-start gap-2 text-[13px] mb-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={grantWrite}
                disabled={busy}
                onChange={(e) => setGrantWrite(e.target.checked)}
              />
              <span>
                Permitir también <strong>crear y editar</strong> (actividades, gastos y lugares). Sin marcar, la conexión
                queda de solo lectura.
              </span>
            </label>
            <p className="muted text-[12px] mb-4">Si no iniciaste esta conexión vos, cerrá esta ventana.</p>

            {error && <div className="alert alert-error">{error}</div>}

            {!CLIENT_ID ? (
              <div className="alert alert-warning">
                Falta configurar <code>VITE_GOOGLE_CLIENT_ID_TP</code>.
              </div>
            ) : busy ? (
              <p className="muted text-center">Procesando…</p>
            ) : !credential ? (
              <>
                <p className="muted text-center mb-2">Primero verificá tu identidad con tu cuenta de Google habilitada.</p>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(resp) => setCredential(resp.credential)}
                    onError={() => setError('No se pudo iniciar sesión con Google')}
                  />
                </div>
                <div className="flex justify-center mt-4">
                  <button className="btn-link" onClick={() => finish(() => denyMcpAuthorization(params))}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-center mb-3">
                  Autorizar como <strong>{google?.email || 'tu cuenta de Google'}</strong>
                </p>
                <div className="flex justify-center gap-2">
                  <button className="btn btn-secondary" onClick={() => finish(() => denyMcpAuthorization(params))}>
                    Cancelar
                  </button>
                  <button className="btn" onClick={() => finish(() => approveMcpAuthorization({ ...params, grant_write: grantWrite }, credential))}>
                    Autorizar
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
