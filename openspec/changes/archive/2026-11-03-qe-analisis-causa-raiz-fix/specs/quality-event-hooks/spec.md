## ADDED Requirements

### Requirement: Hook useAprobarCausaRaiz
`src/features/quality-events/hooks/useAprobarCausaRaiz.ts` SHALL export `useAprobarCausaRaiz()`, a `useMutation` over `aprobarCausaRaiz(id, pin)`. On success, it SHALL invalidate `['quality-events', 'list']`, `QE_QUERY_KEYS.detail(id)` and `QE_AUDIT_TRAIL_QUERY_KEY(id)`. It SHALL NOT show its own error toast: the caller (`QEInvestigationSection`) decides between inline and toast errors according to the `errorCode`.

#### Scenario: Success invalidates detail and audit trail
- **WHEN** the mutation succeeds for `qe-1`
- **THEN** the detail, list and audit trail queries for `qe-1` are invalidated
