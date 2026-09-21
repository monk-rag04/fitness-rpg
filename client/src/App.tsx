import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'ok' | 'error';

const statusLabels: Record<ApiStatus, string> = {
  checking: 'Checking...',
  ok: 'ok',
  error: 'unavailable',
};

function isHealthyResponse(value: unknown): value is { status: 'ok' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'ok'
  );
}

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let isCancelled = false;

    async function checkApiHealth() {
      try {
        const response = await fetch('/api/health');

        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}.`);
        }

        const body: unknown = await response.json();

        if (!isHealthyResponse(body)) {
          throw new Error('Health check returned an unexpected response.');
        }

        if (!isCancelled) {
          setApiStatus('ok');
        }
      } catch {
        if (!isCancelled) {
          setApiStatus('error');
        }
      }
    }

    void checkApiHealth();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <main>
      <section aria-labelledby="page-title">
        <p className="eyebrow">Fitness RPG</p>
        <h1 id="page-title">Production Foundation</h1>
        <p className="status" aria-live="polite">
          API Status: <strong data-status={apiStatus}>{statusLabels[apiStatus]}</strong>
        </p>
      </section>
    </main>
  );
}
