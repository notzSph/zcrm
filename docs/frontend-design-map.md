# zSpinach → zCRM frontend map

The reference repository is read-only. zCRM adapts its visual system rather than copying marketing content.

| zSpinach reference | zCRM implementation |
|---|---|
| Fixed translucent `Header`, compact uppercase mono navigation, numbered mobile menu | Sticky application header with numbered Pipeline, Calendar, Leads and Workspaces routes; compact mobile overlay |
| Dark `shell-wrapper`, violet/cyan radial signal field and restrained grid | Global CRM background field in `crm-system.scss`, shared across authenticated and public routes |
| 1400px centered sections with large balanced headings and mono eyebrows | Shared route page/header system covering dashboard, directory, calendar, businesses, details and profile |
| `GenericCard` gradient glass, accent top rail, subtle border/glow | Shared card, board, calendar, agenda, list, form and detail surface primitives |
| `GenericForm` dark controls, high-contrast focus ring, pill primary action | Shared controls plus rebuilt auth cards and existing route forms |
| Compact status signals and terminal-like metadata | Workspace context bar, quick views, account state, pipeline/status/reminder chips |
| Responsive header and card grids | Desktop top navigation, tablet/mobile menu, compact workspace bar, existing route grids retained |

Business logic, API paths, authentication redirects, route structure, keyboard semantics and reduced-motion behavior remain unchanged.
