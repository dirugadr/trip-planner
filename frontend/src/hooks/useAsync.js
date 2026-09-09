import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Runs an async function and tracks { data, loading, error }.
 * Re-runs when any value in `deps` changes, or when `reload()` is called.
 */
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  // Keep the latest fn without making it a dependency.
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  // Stable primitive key so a fresh deps array on each render doesn't re-fire the effect.
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    setState((s) => (s.loading ? s : { ...s, loading: true, error: null }));

    fnRef.current().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      },
      (error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, reload };
}
