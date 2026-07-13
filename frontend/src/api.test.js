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

  test('AI categorization can finish after the global 15 second timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(new Response(
        JSON.stringify({ results: {}, sources: {}, ai_used: false, ai_available: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )), 20000);
    })));
    const api = await import('./api.js');

    const pending = api.categorizeAI.categorize([{ label: 'TEST', amount: -1 }]);
    await vi.advanceTimersByTimeAsync(20000);

    await expect(pending).resolves.toMatchObject({ ai_available: true });
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

    await expect(api.accounts.list()).rejects.toThrow('Connexion interrompue');

    expect(snapshots.at(-1)).toBe('offline');
    unsubscribe();
  });

  test('a technical 500 is replaced by an actionable message with its reference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Erreur interne du serveur (ProgrammingError).' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'abc123def456' },
      },
    )));
    const api = await import('./api.js');

    await expect(api.accounts.list()).rejects.toThrow(
      'Un problème technique a empêché cette action. Rien n’a été perdu : réessayez dans un instant. Référence : abc123def456.',
    );
  });

  test('a useful upstream banking error stays understandable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'La banque est temporairement débordée.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )));
    const api = await import('./api.js');

    await expect(api.accounts.list()).rejects.toThrow('La banque est temporairement débordée.');
  });
});
