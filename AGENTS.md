 # Architecture rules

- Resolve DREN exam values from nested CEPE blocks and derive threshold percentages from candidate counts; show unavailable report values as missing rather than zero to avoid misleading results.

- Import reference spreadsheets through parameterized JSON recordsets in one atomic, advisory-locked transaction; retry the identical replacement payload to reduce remote round trips without duplicates or partial deletion.

- Render DREN reports as one continuous content-driven sheet; let the shared A4 export paginate table groups naturally instead of reserving empty page heights.

- Reuse `EfficienceGrid` for school and DREN efficiency rendering, passing DREN report points unchanged; this keeps chart geometry and theme colors aligned without changing scores.

- Keep native TDB PDF sizing in the shared HTML export utility; reflow the content width before uniform zoom so a single page fills the printable width without distorting charts.
- Centralize TDB efficiency and bottleneck indicator adaptation in `src/utils/tdbEfficience.ts`, prioritizing imported `indicateurs` and retaining missing values; this prevents inconsistent axes and fabricated scores across dashboards.
- Scope Home/Admin presentation rules in global CSS using semantic theme tokens; keep homepage identity tokens isolated and its header fixed across the full page to preserve contrast and navigation without changing dashboard data flows.
- Keep DREN reference calculations in `src/utils/tdbDrenFormulas.ts` and delegate efficiency scoring to the shared TDB adapter; this separates age-specific and annual-flow formulas from presentation while preserving consistent chart axes.- Compute DREN préscolaire/collège/lycée TDB indicators client-side in `src/utils/tdbDrenNiveaux.ts` from per-sector raw sums returned by the `getTdbDrenNiveau` edge action; this keeps SQL simple and formulas testable.
