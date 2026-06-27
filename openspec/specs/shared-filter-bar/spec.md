# Spec: shared-filter-bar

## Purpose

TBD — Shared layout container component that provides consistent spacing and flex behavior for module filter controls. Used by NCListFilters and any future list filter panels to ensure a uniform filter bar appearance across the app.

---

## Requirements

### Requirement: FilterBar provides a standardized container for module filter controls
The system SHALL export a `FilterBar` component from `src/components/shared/FilterBar.tsx` that accepts `children: React.ReactNode` and an optional `className?: string` prop. The component SHALL render a `<div>` with the base classes `flex flex-wrap items-end gap-3 mb-4` plus any additional `className` provided. The component SHALL NOT manage filter state, form submission, or URL params — it is purely a layout/style container. The component SHALL support dark mode through its children's own dark mode classes without adding any dark mode styles itself.

#### Scenario: FilterBar renders children within a flex container
- **WHEN** FilterBar is rendered with three child filter inputs
- **THEN** all three children appear inside a single `div` with `flex flex-wrap items-end gap-3 mb-4` classes

#### Scenario: FilterBar merges additional className with base classes
- **WHEN** FilterBar is rendered with `className="mt-2"`
- **THEN** the rendered div has both the base classes and `mt-2`

#### Scenario: FilterBar does not add state or side effects
- **WHEN** FilterBar mounts and unmounts
- **THEN** no URL params, localStorage, or React state are modified
