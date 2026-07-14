import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@chameleon/shared';

export function useFetchStatus() {
  const [status, setStatus] = useState(null); // { label, phase, current, total }
  const frameRef = useRef(0);
  const rafRef = useRef(null);
  const startRef = useRef(Date.now());

  // No braille spinner animation needed — Loader2 handles it via CSS

  const start = useCallback((label, total = 0) => {
    startRef.current = Date.now();
    setStatus({ label, phase: 'fetching', current: 0, total, _frame: 0 });
  }, []);

  const progress = useCallback((current, phase) => {
    setStatus(s => s ? { ...s, current, phase: phase || s.phase } : null);
  }, []);

  const complete = useCallback((summary) => {
    const elapsed = ((Date.now() - startRef.current) / 1000).toFixed(1);
    setStatus(s => s ? { ...s, phase: 'complete', label: `${s.label} ✓ (${elapsed}s)`, summary } : null);
    setTimeout(() => setStatus(null), 1500); // auto-clear
  }, []);

  const error = useCallback((msg) => {
    setStatus(s => s ? { ...s, phase: 'error', label: `${s.label} ✗ ${msg}` } : null);
    setTimeout(() => setStatus(null), 3000);
  }, []);

  const render = useCallback(() => {
    if (!status) return null;
    const spinner = null;
    const pct = status.total ? ` ${Math.round((status.current / status.total) * 100)}%` : '';
    const phaseIcons = { fetching: 'search', processing: 'settings', saving: 'save', complete: 'check', error: 'x' };
    return (
      <div className="fetch-status" style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', borderRadius: '6px',
        background: 'rgba(196,181,253,0.1)', border: '1px solid rgba(196,181,253,0.3)',
        fontSize: '0.85rem', fontFamily: 'monospace', color: '#c4b5fd'
      }}>
        <span>{phaseIcons[status.phase] ? <Icon name={phaseIcons[status.phase]} size={16} /> : <Icon name="loader" size={16} className="spin" />}</span>
        <span>{status.label}{pct}</span>
        {status.summary && <span style={{ opacity: 0.7, marginLeft: 'auto' }}>{status.summary}</span>}
      </div>
    );
  }, [status]);

  return { status, start, progress, complete, error, render };
}

// Convenience wrapper for api calls
export function useApiWithStatus(apiFn) {
  const { start, progress, complete, error, status, render } = useFetchStatus();

  const execute = useCallback(async (...args) => {
    start(`Loading ${apiFn.name || 'data'}...`);
    try {
      const result = await apiFn(...args);
      const count = Array.isArray(result) ? result.length : (result?.count ?? 1);
      complete(`Loaded ${count} item${count !== 1 ? 's' : ''}`);
      return result;
    } catch (err) {
      error(err.message);
      throw err;
    }
  }, [apiFn, start, progress, complete, error]);

  return { execute, status, render };
}