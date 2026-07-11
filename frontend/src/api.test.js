import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe('backend availability tracking', () => {
  test('a GoCardless timeout does not announce that the Wealthly server is offline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('upstream timeout')));
    const api = await import('./api.js');
    const snapshots = [];
    const unsubscribe = api.subscribeBackendStatus((state) => snapshots.push(state.status));

    await expect(api.banking.sync('connection-1')).rejects.toThrow();

    expect(snapshots).toEqual(['online']);
    unsubscribe();
  });

  test('an HTTP 502 proves the backend answered and does not trigger the offline banner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Banque indisponible' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )));
    const api = await import('./api.js');
    const snapshots = [];
    const unsubscribe = api.subscribeBackendStatus((state) => snapshots.push(state.status));

    await expect(api.accounts.list()).rejects.toThrow('Banque indisponible');

    expect(snapshots).toEqual(['online']);
    unsubscribe();
  });

  test('a genuine network failure on a normal API call still marks the backend offline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const api = await import('./api.js');
    const snapshots = [];
    const unsubscribe = api.subscribeBackendStatus((state) => snapshots.push(state.status));

    await expect(api.accounts.list()).rejects.toThrow('Impossible de joindre le serveur');

    expect(snapshots.at(-1)).toBe('offline');
    unsubscribe();
  });
});
