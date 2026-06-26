## ADDED Requirements

### Requirement: Pagination component renders paginated navigation controls
The system SHALL export a `Pagination` component from `src/components/shared/Pagination.tsx` that accepts `currentPage: number`, `totalPages: number`, `totalItems: number`, `pageSize: number`, and `onPageChange: (page: number) => void` as props. The component SHALL render a "Mostrando X–Y de Z" summary using the i18n key `common:pagination.showing` with interpolation variables `from`, `to`, and `total`. The component SHALL render previous/next buttons and page number buttons using a sliding window algorithm (show up to 7 page numbers; use ellipsis `…` for gaps). The active page button SHALL use `bg-coral text-white`. Disabled previous/next buttons SHALL have `disabled:cursor-not-allowed disabled:opacity-40`. The component SHALL support dark mode via `dark:` Tailwind variants. The component SHALL NOT render if `totalItems === 0`.

#### Scenario: Renders showing summary with correct range
- **WHEN** `currentPage=2`, `pageSize=5`, `totalItems=23`, `totalPages=5`
- **THEN** the "Mostrando" text shows `from=6`, `to=10`, `total=23`

#### Scenario: Previous button is disabled on first page
- **WHEN** `currentPage=1` and `totalPages=3`
- **THEN** the previous button has `disabled` attribute

#### Scenario: Next button is disabled on last page
- **WHEN** `currentPage=3` and `totalPages=3`
- **THEN** the next button has `disabled` attribute

#### Scenario: Active page button is highlighted
- **WHEN** `currentPage=2` and `totalPages=5`
- **THEN** the button for page 2 has `bg-coral text-white` classes and `aria-current="page"`

#### Scenario: Ellipsis appears for large page ranges
- **WHEN** `totalPages=20` and `currentPage=10`
- **THEN** ellipsis elements appear between page 1 and the window, and between the window and page 20

#### Scenario: Component does not render when totalItems is zero
- **WHEN** `totalItems=0`
- **THEN** the `Pagination` component renders nothing

#### Scenario: onPageChange called with correct page number when button clicked
- **WHEN** a user clicks the button for page 3
- **THEN** `onPageChange` is called with argument `3`
