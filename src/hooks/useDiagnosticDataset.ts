import { useEffect, useState } from 'react';
import { diagnosticApi, DiagnosticDataset } from '@/services/api';

export const useDiagnosticDataset = (
  codeDren: number,
  codeCisco: number,
  sessionToken: string | null,
  nonce = 0,
  enabled = true,
) => {
  const [dataset, setDataset] = useState<DiagnosticDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Ne jamais conserver le dataset d'un autre périmètre : on le vide dès
    // que la portée change, avant même la réponse serveur.
    setDataset(null);
    setError(null);

    if (!enabled) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    if (!sessionToken) {
      setLoading(false);
      setError('Session expirée ou invalide. Reconnectez-vous pour consulter un diagnostic.');
      return () => { cancelled = true; };
    }

    setLoading(true);
    diagnosticApi
      .getDataset(codeDren, codeCisco, sessionToken)
      .then((d) => {
        if (cancelled) return;
        // Le serveur fait foi sur le périmètre : si la réponse porte sur un
        // autre périmètre que celui autorisé (service déployé obsolète qui
        // ignore la portée), on refuse d'afficher des chiffres nationaux à un
        // compte DREN/CISCO.
        const gotDren = Number((d as any)?.scope?.codeDren);
        const gotCisco = Number((d as any)?.scope?.codeCisco);
        if (gotDren !== codeDren || gotCisco !== codeCisco) {
          setDataset(null);
          setError(
            `Données reçues pour un autre périmètre (DREN ${gotDren || '—'} / CISCO ${gotCisco || '—'}) ` +
            `que celui autorisé (DREN ${codeDren || 'national'} / CISCO ${codeCisco || 'tous'}). ` +
            `Affichage bloqué : le service de diagnostic déployé doit être mis à jour.`,
          );
          return;
        }
        setDataset(d);
      })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [codeDren, codeCisco, sessionToken, nonce, enabled]);

  return { dataset, loading, error };
};
