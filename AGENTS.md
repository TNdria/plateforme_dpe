 # Architecture rules

- Keep native TDB PDF sizing in the shared HTML export utility; reflow the content width before uniform zoom so a single page fills the printable width without distorting charts.
- Centralize TDB efficiency and bottleneck indicator adaptation in `src/utils/tdbEfficience.ts`, prioritizing imported `indicateurs` and retaining missing values; this prevents inconsistent axes and fabricated scores across dashboards.