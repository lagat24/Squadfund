import { useCallback, useEffect, useRef, useState } from "react";

// Loads data and keeps the previous result on screen while reloading.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const tick = useRef(0);
  const run = useCallback(async () => {
    const id = ++tick.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (id === tick.current) setState({ loading: false, data, error: null });
    } catch (error) {
      if (id === tick.current) setState((s) => ({ loading: false, data: null, error }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run };
}

// Runs an async action with busy/error state.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, clear: () => setError(null) };
}
