# Plan Filters

Use these filters to keep planning sessions focused and actionable. Combine them in GitHub issue search or Projects views to limit the scope of a plan to only the items that matter for the current iteration.

## Scope filters
- `label:type/feature` – net-new capabilities (UI or behavior changes).
- `label:type/bug` – defects or regressions.
- `label:type/chore` – refactors, dependency, or tooling upkeep.
- `label:security` – security-sensitive work; always prioritized.

## Platform filters
- `label:platform/windows` – Windows-specific behavior, installers, or integration.
- `label:platform/linux` – Linux-specific behavior or packaging.
- `label:platform/cross` – cross-platform concerns (Electron, OBS WebSocket).

## Area filters
- `label:area/connection` – OBS WebSocket connection management.
- `label:area/ui` – layout, styling, theming, or accessibility.
- `label:area/media` – streaming, recording, and statistics.
- `label:area/audio` – mixer controls, levels, and devices.

## Priority filters
- `label:priority/now` – must land in the current iteration.
- `label:priority/next` – planned for the next iteration.
- `label:priority/later` – backlog; schedule only if capacity remains.

## Example queries
- Current iteration focus:  
  `is:issue is:open label:priority/now`
- Bug bash for Windows:  
  `is:issue is:open label:type/bug label:platform/windows`
- UI polish list:  
  `is:issue is:open label:area/ui label:type/feature`

## Usage guidelines
1. Start every planning session by applying at least one scope filter and one priority filter.
2. When pairing platform and area filters, favor the smallest viable set (e.g., `platform/windows` + `area/connection`).
3. Security-labeled work is always in scope regardless of other filters.
4. Update labels before or after planning to keep future filters accurate.
