import { useState, useEffect, useCallback } from 'react';

/**
 * Runs an async function and tracks { data, loading, error }.
 * `deps` controls when it re-runs; `reload()` re-runs on demand.
 */
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const run = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    asyncFn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  const reload = useCallback(() => {
    run();
  }, [run]);

  return { ...state, reload };
}
