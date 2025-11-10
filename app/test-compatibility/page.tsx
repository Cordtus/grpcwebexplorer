'use client';

import { useState } from 'react';

interface TestStats {
  total: number;
  successful: number;
  errors: number;
  internalErrors: number;
  unimplemented: number;
  requiresParams: number;
  skipped: number;
  totalTime: number;
}

interface TestResult {
  service: string;
  method: string;
  status: string;
  error?: string;
  executionTime?: number;
}

export default function TestCompatibilityPage() {
  const [endpoint, setEndpoint] = useState('grpc.testnet.penumbra.zone:443');
  const [serviceFilter, setServiceFilter] = useState('penumbra');
  const [tlsEnabled, setTlsEnabled] = useState(true);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<TestStats | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [groupedErrors, setGroupedErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setStats(null);
    setResults([]);
    setGroupedErrors({});

    try {
      const response = await fetch('/api/grpc/test-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          tlsEnabled,
          serviceFilter: serviceFilter || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setResults(data.results);
        setGroupedErrors(data.groupedErrors || {});
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run tests');
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-success-green';
      case 'error': return 'text-error-red';
      case 'internal_error': return 'text-destructive font-bold';
      case 'unimplemented': return 'text-warning-yellow';
      case 'requires_params': return 'text-primary';
      case 'skip': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'internal_error': return '🔥';
      case 'unimplemented': return '⚠️';
      case 'requires_params': return '⏭️';
      case 'skip': return '⊘';
      default: return '?';
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">gRPC Compatibility Tester</h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="grpc.testnet.penumbra.zone:443"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Service Filter (optional)</label>
            <input
              type="text"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="penumbra"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={tlsEnabled}
              onChange={(e) => setTlsEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium">Enable TLS</span>
          </label>
        </div>

        <button
          onClick={runTest}
          disabled={testing || !endpoint}
          className="bg-primary text-primary-foreground px-6 py-2 rounded hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed"
        >
          {testing ? 'Testing... (this may take a few minutes)' : 'Run Compatibility Test'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <strong>Error:</strong> {error}
        </div>
      )}

      {stats && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Test Results</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-success-green">{stats.successful}</div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-error-red">{stats.errors + stats.internalErrors}</div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning-yellow">{stats.unimplemented}</div>
              <div className="text-sm text-muted-foreground">Unimplemented</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.requiresParams}</div>
              <div className="text-sm text-muted-foreground">Requires Params</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Total: {stats.total} methods tested in {(stats.totalTime / 1000).toFixed(2)}s
          </div>
        </div>
      )}

      {Object.keys(groupedErrors).length > 0 && (
        <div className="bg-red-50 shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-red-800">Critical Errors by Type</h2>

          {Object.entries(groupedErrors).map(([errorType, methods]) => (
            <div key={errorType} className="mb-4">
              <h3 className="font-bold text-lg mb-2 text-red-700">
                {errorType} ({methods.length} method{methods.length > 1 ? 's' : ''})
              </h3>
              <ul className="list-disc list-inside pl-4 space-y-1">
                {methods.map((method, idx) => (
                  <li key={idx} className="text-sm font-mono text-foreground">{method}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Detailed Results</h2>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.filter(r => r.status !== 'skip').map((result, idx) => (
              <div key={idx} className="border-b pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className={`text-xl mr-2`}>{getStatusIcon(result.status)}</span>
                    <span className="font-mono text-sm">
                      {result.service}.{result.method}
                    </span>
                  </div>
                  <div className={`text-sm ${getStatusColor(result.status)}`}>
                    {result.executionTime ? `${result.executionTime}ms` : ''}
                  </div>
                </div>
                {result.error && result.status !== 'unimplemented' && result.status !== 'requires_params' && (
                  <div className="text-xs text-muted-foreground mt-1 pl-8 font-mono whitespace-pre-wrap">
                    {result.error.substring(0, 200)}
                    {result.error.length > 200 ? '...' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
