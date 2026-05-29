# TODO

## Phase 1 — Identify and implement premium Organic Green loading + chart styling
- [x] Inspect existing chart + loading implementations in `DashboardPage` and `ReportsPage`.
- [x] Review Tailwind/theme variables and global CSS for Organic & Earthy (Green).
- [x] Create shared `OrganicLoader` component (modern lite loading + subtle transition).
- [x] Create shared Recharts chart theme helpers (colors, tooltip/card styling, axis/grid styles).
- [x] Update `DashboardPage` (OrganicLoader + premium green chart styling).
- [x] Update `ReportsPage` (premium green charts + subtle transitions).


  - [x] Replace inline loading spinner with `OrganicLoader`.

  - [x] Upgrade PieChart styling (premium labels/tooltip/cells hover).
  - [x] Upgrade BarChart styling (grid/axes/tooltip/rounded bars).
  - [x] Add subtle fade-in transition on chart render.
- [ ] Update `ReportsPage`:
  - [x] Upgrade BarChart + PieCharts using shared theme.
  - [x] Add subtle fade-in transition on chart render.
- [ ] Ensure build passes (`yarn start` / `yarn build`).


