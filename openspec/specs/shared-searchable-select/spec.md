# Spec: shared-searchable-select

## Purpose

Define the `SearchableSelect` reusable combobox component at `src/components/shared/SearchableSelect.tsx`. Replaces native `<select>` elements in forms where the option list can contain a large number of records (e.g., incidents, nonconformities), providing inline text filtering and keyboard-accessible selection while integrating with React Hook Form via `Controller`.

---

## Requirements

### Requirement: SearchableSelect renders a combobox with integrated text search
The system SHALL export a `SearchableSelect` component from `src/components/shared/SearchableSelect.tsx`. The component SHALL accept the following props: `options: SearchableOption[]`, `value: string | undefined`, `onChange: (id: string | undefined) => void`, `placeholder?: string`, `ariaLabel: string`, `disabled?: boolean`. `SearchableOption` SHALL be defined as `{ id: string; label: string; sublabel?: string }`. The component SHALL render a text `<input>` with a Search icon from `lucide-react` on the left side. The dropdown SHALL open when the user focuses the input or types in it. The component SHALL have `role="combobox"`, `aria-expanded`, and `aria-label` attributes set correctly at all times.

#### Scenario: Combobox opens on input focus
- **WHEN** the user clicks or focuses the search input
- **THEN** the dropdown list of options becomes visible and `aria-expanded` is set to `"true"`

#### Scenario: Combobox closes when focus leaves the component
- **WHEN** the user clicks outside the SearchableSelect component
- **THEN** the dropdown closes and `aria-expanded` is set to `"false"`

#### Scenario: aria-label is applied to the input element
- **WHEN** `ariaLabel="Seleccionar incidente"` is passed as a prop
- **THEN** the input element has `aria-label="Seleccionar incidente"`

---

### Requirement: SearchableSelect filters options in real time by label and sublabel
The system SHALL filter the `options` array on every keystroke in the search input, matching against both `option.label` and `option.sublabel` (case-insensitive). Unmatched options SHALL not be rendered in the dropdown. The filter SHALL apply to the current `options` prop value — no additional API call is triggered by typing.

#### Scenario: Typing filters options by label
- **WHEN** the user types `"INC"` and `options` contains items with labels starting with `"INC-2025-001"` and `"DOC-2025-002"`
- **THEN** only the item matching `"INC"` appears in the dropdown

#### Scenario: Typing filters options by sublabel
- **WHEN** the user types `"almacén"` and an option has `sublabel` containing `"almacén"`
- **THEN** that option appears in the filtered dropdown even if its `label` does not contain `"almacén"`

#### Scenario: Filter is case-insensitive
- **WHEN** the user types `"inc-2025"` (lowercase)
- **THEN** an option with label `"INC-2025-001"` is included in the filtered results

---

### Requirement: SearchableSelect dropdown shows at most 6 options before vertical scroll
The system SHALL constrain the visible dropdown height to show a maximum of 6 option rows without scrolling. When the filtered list exceeds 6 items, a vertical scrollbar SHALL appear and the remaining items SHALL be accessible by scrolling. The dropdown SHALL use `overflow-y-auto` with a fixed `max-height` that accommodates exactly 6 option rows.

#### Scenario: Dropdown scrolls when filtered list exceeds 6 items
- **WHEN** the filtered options contain 10 items
- **THEN** the dropdown renders with a scrollbar and only 6 items are visible without scrolling

#### Scenario: Dropdown requires no scroll when filtered list has 3 items
- **WHEN** the filtered options contain 3 items
- **THEN** the dropdown renders all 3 items without a scrollbar

---

### Requirement: SearchableSelect each option renders label bold with sublabel and secondary info
The system SHALL render each option row as: `<span class="font-semibold">{option.label}</span>` followed by `option.sublabel` (truncated at 60 characters with `…` if longer). The option row SHALL be interactive and highlight on hover and keyboard focus using design-system colors. Clicking an option SHALL select it.

#### Scenario: Option row displays label in bold followed by sublabel
- **WHEN** an option with `label="INC-2025-001"` and `sublabel="Derrame en almacén (Zona A)"` is rendered
- **THEN** the row shows `INC-2025-001` in bold followed by the sublabel text

#### Scenario: Sublabel longer than 60 characters is truncated with ellipsis
- **WHEN** `option.sublabel` is 80 characters long
- **THEN** the rendered sublabel shows only the first 60 characters followed by `…`

---

### Requirement: SearchableSelect registers the selected id into React Hook Form, not the display text
The system SHALL call `onChange(option.id)` when the user selects an option, where `option.id` is the opaque identifier passed in the `options` array. The visible text in the input SHALL update to show `option.label` after selection, but the value stored in RHF SHALL be `option.id`. The component is intended to be used inside a `<Controller>` from React Hook Form with `render={({ field }) => <SearchableSelect ... onChange={field.onChange} value={field.value} />}`.

#### Scenario: Selecting an option calls onChange with the option id
- **WHEN** the user selects the option with `id="inc-uuid-001"` and `label="INC-2025-001"`
- **THEN** `onChange` is called with `"inc-uuid-001"` and the input displays `"INC-2025-001"`

#### Scenario: RHF field value is the id, not the display label
- **WHEN** the user selects an option and the form is submitted
- **THEN** the RHF field value for the controlled field equals `option.id`, not `option.label`

---

### Requirement: SearchableSelect shows × clear button when a value is selected
The system SHALL render a × (clear) button inside the search input when `value` is not `undefined`. Clicking the × button SHALL call `onChange(undefined)` and clear the input text, reverting the component to its empty state. The × button SHALL have `aria-label` from the consumer or a default `t('common:clear')`.

#### Scenario: × button is visible when a value is selected
- **WHEN** `value` prop is a non-empty string
- **THEN** a × clear button is rendered inside the search input area

#### Scenario: × button is not rendered when no value is selected
- **WHEN** `value` prop is `undefined`
- **THEN** no × button appears in the input area

#### Scenario: Clicking × calls onChange with undefined and clears input
- **WHEN** the user clicks the × button
- **THEN** `onChange(undefined)` is called, the input text is cleared, and the dropdown remains closed

---

### Requirement: SearchableSelect shows no-results message when filter matches nothing
The system SHALL render an inline empty-state message inside the dropdown when the search input has text but the filtered options array is empty. The message SHALL display the typed query and use the i18n key `common:searchableSelect.noResults` with interpolation `{ query }`.

#### Scenario: No-results message shown when filter matches nothing
- **WHEN** the user types `"zzz"` and no option matches
- **THEN** the dropdown shows a message containing the text `"zzz"` and no option rows

#### Scenario: No-results message is not shown when input is empty
- **WHEN** the search input is empty and options are available
- **THEN** all options render in the dropdown without a no-results message

---

### Requirement: SearchableSelect is disabled when disabled prop is true
The system SHALL set the search input to `disabled` and suppress all pointer events on the dropdown trigger when `disabled={true}` is passed. The component SHALL apply `opacity-50 cursor-not-allowed` visual treatment to the input when disabled.

#### Scenario: Disabled component does not open dropdown on click
- **WHEN** `disabled={true}` is passed and the user clicks the input
- **THEN** the dropdown does not open
