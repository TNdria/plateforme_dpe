import { useEffect, useState } from 'react';
import { diagnosticApi, DiagnosticDataset } from '@/services/api';

export const useDiagnosticDataset = (codeDren: number, codeCisco: number) => {
  const [dataset, setDataset] = useState<DiagnosticDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    diagnosticApi
      .getDataset(codeDren, codeCisco)
      .then((d) => { if (!cancelled) setDataset(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [codeDren, codeCisco]);

  return { dataset, loading, error };
};
