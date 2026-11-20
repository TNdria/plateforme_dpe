import { describe, expect, it } from 'vitest';
import { normalizeDiagnosticDataset } from './diagnosticDataset';

describe('normalizeDiagnosticDataset — places assises', () => {
  it('convertit l’ancienne forme (nombre par niveau) en { total }', () => {
    const dataset = {
      annees: {
        2026: { places: { presco: 8060, primaire: 78184, college: 16840, lycee: 5611 } },
      },
    };
    normalizeDiagnosticDataset(dataset);
    expect(dataset.annees[2026].places).toEqual({
      presco: { total: 8060 },
      primaire: { total: 78184 },
      college: { total: 16840 },
      lycee: { total: 5611 },
    });
  });

  it('laisse intacte la forme courante { total }', () => {
    const dataset = {
      annees: { 2025: { places: { primaire: { total: 59895 }, college: { total: 0 } } } },
    };
    normalizeDiagnosticDataset(dataset);
    expect(dataset.annees[2025].places.primaire).toEqual({ total: 59895 });
    expect(dataset.annees[2025].places.college).toEqual({ total: 0 });
  });

  it('conserve l’absence de valeur au lieu d’inventer zéro', () => {
    const dataset = { annees: { 2024: { places: { primaire: null } } } };
    normalizeDiagnosticDataset(dataset);
    expect(dataset.annees[2024].places.primaire.total).toBeUndefined();
  });
});

describe('normalizeDiagnosticDataset — dont filles', () => {
  it('déduit filles/garcons de f/g quand la version déployée ne les envoie pas', () => {
    const dataset = {
      annees: {
        2026: {
          eleves: {
            presco: { g: 100, f: 90, total: 190 },
            primaire: { g: 300, f: 280, total: 580, grades: { T1: { g: 60, f: 55, total: 115 } } },
          },
        },
      },
    };
    normalizeDiagnosticDataset(dataset);
    const annees: any = dataset.annees;
    expect(annees[2026].eleves.presco.filles).toBe(90);
    expect(annees[2026].eleves.presco.garcons).toBe(100);
    expect(annees[2026].eleves.primaire.filles).toBe(280);
    // total et grades restent intacts
    expect(annees[2026].eleves.primaire.total).toBe(580);
    expect(annees[2026].eleves.primaire.grades.T1.total).toBe(115);
  });

  it('ne remplace pas filles/garcons déjà fournis', () => {
    const dataset = {
      annees: { 2025: { eleves: { college: { g: 10, f: 5, filles: 5, garcons: 10, total: 15 } } } },
    };
    normalizeDiagnosticDataset(dataset);
    expect(dataset.annees[2025].eleves.college.filles).toBe(5);
    expect(dataset.annees[2025].eleves.college.garcons).toBe(10);
  });

  it('laisse filles absent si ni filles ni f ne sont disponibles', () => {
    const dataset = { annees: { 2024: { eleves: { lycee: { total: 0 } as Record<string, any> } } } };
    normalizeDiagnosticDataset(dataset);
    expect(dataset.annees[2024].eleves.lycee.filles).toBeUndefined();
  });
});
