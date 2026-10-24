import { drenDivide, drenRead, drenFormat, drenSum } from '@/utils/tdbDrenFormulas';

export function DrenReferenceTables({ dren, mada }: { dren: any; mada: any }) {
  const qualification = (e: any) => {
    const count = drenRead(e, 'enseignants_qualifies');
    return count === null ? drenRead(e, 'ratio_eq') : drenDivide(count, e?.personnel?.pers_en_classe);
  };
  const resources = (e: any) => {
    const r = e?.ressources || {}, p = e?.personnel || {};
    return [
      drenDivide(drenRead(e, 'nbr_eleve_pub'), drenRead(e, 'pers_en_classe_pub'), 1),
      drenDivide(drenRead(e, 'nbr_eleve_prive'), drenRead(e, 'pers_en_classe_prive'), 1),
      qualification(e),
      drenDivide(drenRead(e, 'nbr_eleve_pub'), drenRead(e, 'personnel_administratif_pub'), 1),
      drenRead(e, 'taux_aleas_enseignants'),
      drenDivide(drenRead(e, 'epp_cap'), drenRead(e, 'total_epp')),
      drenDivide(drenRead(e, 'epp_continues'), drenRead(e, 'total_epp')),
      drenDivide(drenRead(e, 'fokontany_avec_epp'), drenRead(e, 'total_fokontany')),
      drenDivide(drenRead(e, 'etab_cantine'), r.nbr_etab),
      drenDivide(drenRead(e, 'etab_handicap'), r.nbr_etab),
      drenDivide(e?.sections?.nbr_section, p.pers_en_classe, 1),
      drenDivide(e?.caisse?.total_fce, r.nbr_eleve, 1),
      drenDivide(drenRead(e, 'montant_subventions'), r.nbr_eleve, 1),
      drenDivide(drenRead(e, 'montant_fram'), r.nbr_eleve, 1),
      drenDivide(drenRead(e, 'montant_autres'), r.nbr_eleve, 1),
      drenDivide(drenSum([e?.caisse?.total_fce, drenRead(e, 'montant_subventions'), drenRead(e, 'montant_fram'), drenRead(e, 'montant_autres')]), r.nbr_eleve, 1),
    ];
  };
  const labels = [
    ['Élèves par enseignant — public', ''], ['Élèves par enseignant — privé', ''],
    ['Enseignants qualifiés', ' %'], ['Élèves par personnel administratif — public', ''],
    ['Aléas de répartition des enseignants', ' %'], ['EPP avec CAP préscolaire', ' %'],
    ['EPP continues', ' %'], ['Fokontany avec au moins une EPP', ' %'],
    ['Établissements avec cantine', ' %'], ['Établissements accueillant des élèves en situation de handicap', ' %'],
    ['Groupes pédagogiques par enseignant', ''], ['Caisse école par élève', ' Ar'],
    ['Subventions des partenaires par élève', ' Ar'], ['Cotisations FRAM par élève', ' Ar'],
    ['Autres ressources par élève', ' Ar'], ['Total des ressources financières par élève', ' Ar'],
  ];
  const a = resources(dren), b = resources(mada);
  const rows = labels.map(([label, unit], i) => ({ label, unit, a: a[i], b: b[i] }));
  const evaluations = [
    ['CP2 — Fluidité de lecture', 'cp2_lecture_sm', ' mots/min'],
    ['CP2 — Lecture : seuil de 30 mots/min', 'cp2_lecture_seuil', ' %'],
    ['CP2 — Mathématiques : score moyen', 'cp2_maths_sm', ' /100'],
    ['CP2 — Mathématiques : seuil de 50/100', 'cp2_maths_seuil', ' %'],
    ['CM2 — Malagasy : score moyen', 'cm2_malagasy_sm', ' /100'],
    ['CM2 — Malagasy : seuil de 50/100', 'cm2_malagasy_seuil', ' %'],
    ['CM2 — Français : score moyen', 'cm2_francais_sm', ' /100'],
    ['CM2 — Français : seuil de 50/100', 'cm2_francais_seuil', ' %'],
    ['CM2 — Mathématiques : score moyen', 'cm2_maths_sm', ' /100'],
    ['CM2 — Mathématiques : seuil de 50/100', 'cm2_maths_seuil', ' %'],
    ['CM2 — Seuil atteint dans les trois matières', 'cm2_toutes_matieres_seuil', ' %'],
  ].map(([label, key, unit]) => ({ label, unit, a: drenRead(dren, key), b: drenRead(mada, key) }));
  const table = (title: string, data: typeof rows) => <section className="mt-3 text-xs text-foreground">
    <h3 className="border-b border-border bg-muted px-2 py-2 font-semibold">{title}</h3>
    <table className="w-full border-collapse text-[11px]">
      <thead><tr className="bg-muted"><th className="border border-border p-1 text-left">Indicateur</th><th className="border border-border p-1">DREN</th><th className="border border-border p-1">Madagascar</th></tr></thead>
      <tbody>{data.map(row => <tr key={row.label}><td className="border border-border p-1">{row.label}</td>{[row.a, row.b].map((v, i) => <td key={i} className={`border border-border p-1 text-right tabular-nums ${v === null ? 'bg-muted text-muted-foreground' : ''}`}>{drenFormat(v, row.unit)}</td>)}</tr>)}</tbody>
    </table>
  </section>;
  return <>{table('Ressources et financement — Référentiel DREN', rows)}{table('Évaluation des acquis scolaires — UEAS (CP2 et CM2)', evaluations)}</>;
}