## ADDED Requirements

### Requirement: getDatosPublicacion shared publication-data helper
The system SHALL export `getDatosPublicacion(documento: Documento): { firmadoPorId: string; fecha: string; hash?: string } | undefined` from `features/documents/utils/publicacion.ts`, a pure function with no React/query dependency. It SHALL resolve, in order:
1. The most recent `FIRMA_REGISTRADA` entry in `documento.auditTrail` (by `timestamp`, descending) → `{ firmadoPorId: realizadoPorId, fecha: timestamp, hash: valorNuevo }`.
2. If none exists, the most recent `ESTADO_CAMBIADO` entry whose `estadoNuevo === 'PUBLICADO'` → `{ firmadoPorId: realizadoPorId, fecha: timestamp, hash: undefined }`.
3. If neither exists, and both `documento.aprobadorId` and `documento.fechaEmision` are set → `{ firmadoPorId: aprobadorId, fecha: fechaEmision, hash: undefined }`.
4. Otherwise `undefined`.

Both the Resumen tab's "Documento publicado" card and the sidebar's Ficha card (`Sidebar ficha metadata card`) SHALL consume this single helper instead of each resolving the publication date independently.

#### Scenario: Resolves from the latest FIRMA_REGISTRADA entry
- **WHEN** `documento.auditTrail` contains one or more `FIRMA_REGISTRADA` entries
- **THEN** `getDatosPublicacion` returns the most recent one's `realizadoPorId`, `timestamp`, and `valorNuevo` as `firmadoPorId`, `fecha`, and `hash`

#### Scenario: Falls back to ESTADO_CAMBIADO → PUBLICADO when no FIRMA_REGISTRADA exists
- **WHEN** `documento.auditTrail` has no `FIRMA_REGISTRADA` entry but has an `ESTADO_CAMBIADO` entry with `estadoNuevo === 'PUBLICADO'`
- **THEN** `getDatosPublicacion` returns that entry's `realizadoPorId`/`timestamp` with `hash: undefined`

#### Scenario: Falls back to aprobadorId + fechaEmision as a last resort
- **WHEN** `documento.auditTrail` has neither a `FIRMA_REGISTRADA` nor an `ESTADO_CAMBIADO → PUBLICADO` entry, but `aprobadorId` and `fechaEmision` are both set
- **THEN** `getDatosPublicacion` returns `{ firmadoPorId: aprobadorId, fecha: fechaEmision, hash: undefined }`

#### Scenario: Returns undefined when nothing resolves
- **WHEN** none of the three sources above is available
- **THEN** `getDatosPublicacion` returns `undefined` and callers render their own "never published" fallback

### Requirement: Resumen tab publication content
The Resumen tab panel SHALL render, below the description, in this order:
1. **Documento publicado card** — only when `documento.estado` is `PUBLICADO`, `EN_REVISION_PERIODICA`, or `OBSOLETO`, and `getDatosPublicacion(documento)` resolves: a PDF icon with the filename `{codigo} v{version}.pdf`; a line "Firmado por {nombre} · {fecha y hora} · hash `{primeros 4}…{últimos 4}`" where `{nombre}` comes from `getName(firmadoPorId)` and the hash segment (including its copy button and full-hash tooltip) is omitted entirely when `getDatosPublicacion` returns no `hash`; a "Ver" button using the same visibility condition and action as the sidebar's "Ver documento" (`availability.canVerDocumento` → `controller.setShowVisor(true)`), with no new permission logic; and, only when `documento.estado === 'OBSOLETO'` and `documento.fechaObsolescencia` is set, an additional line "Versión obsoleta desde {fechaObsolescencia}".
2. **Motivo del cambio (v{version})** — `documento.motivoVersion`, when present, regardless of `estado`.
3. **Vigente desde** — `documento.fechaVigencia` as a calendar date (`formatCalendarDateMedium`), only when `estado` is `PUBLICADO` or `EN_REVISION_PERIODICA` and the field is set.

None of these three blocks render in `BORRADOR`, `EN_REVISION`, or `EN_APROBACION`. The archivo original section (`showArchivoSection`) keeps its existing position and visibility condition, unaffected by this requirement.

#### Scenario: Documento publicado card shows signer, date, and abbreviated hash
- **WHEN** a `PUBLICADO` document's Resumen tab renders and `getDatosPublicacion` resolves a `FIRMA_REGISTRADA` entry with a hash
- **THEN** the card shows the filename, "Firmado por {nombre} · {fecha y hora} · {hash abreviado}", the full hash in a tooltip with a copy button, and a "Ver" button

#### Scenario: Documento publicado card omits the hash line when none is available
- **WHEN** `getDatosPublicacion` resolves without a `hash` (fallback 2 or 3)
- **THEN** the card shows "Firmado por {nombre} · {fecha y hora}" with no hash segment and no copy button, and renders without error

#### Scenario: Obsoleto adds the obsolescence date line
- **WHEN** `documento.estado === 'OBSOLETO'` and `documento.fechaObsolescencia` is set
- **THEN** the card includes "Versión obsoleta desde {fechaObsolescencia}" below the signer line

#### Scenario: No publicado card in draft-like states
- **WHEN** `documento.estado` is `BORRADOR`, `EN_REVISION`, or `EN_APROBACION`
- **THEN** the Resumen tab renders no "Documento publicado" card

#### Scenario: Ver button reuses the existing Ver documento action
- **WHEN** the user clicks "Ver" on the Documento publicado card
- **THEN** the same embedded `DocumentViewer` modal opens as when clicking "Ver documento" in the sidebar, with no separate audit call issued by the frontend

#### Scenario: Motivo del cambio shown when present
- **WHEN** `documento.motivoVersion` is set
- **THEN** "Motivo del cambio (v{version})" renders with that text, in any `estado`

#### Scenario: Motivo del cambio absent when not set
- **WHEN** `documento.motivoVersion` is not set
- **THEN** no "Motivo del cambio" section renders

#### Scenario: Vigente desde shown for active published states
- **WHEN** `documento.estado` is `PUBLICADO` or `EN_REVISION_PERIODICA` and `fechaVigencia` is set
- **THEN** "Vigente desde" renders `fechaVigencia` as a calendar date

#### Scenario: Vigente desde absent outside published states
- **WHEN** `documento.estado` is `OBSOLETO`, `BORRADOR`, `EN_REVISION`, or `EN_APROBACION`
- **THEN** "Vigente desde" does not render, even if `fechaVigencia` is set

#### Scenario: Missing description shows a muted placeholder
- **WHEN** `documento.descripcion` is empty or not set
- **THEN** the Resumen tab shows "Sin descripción" in muted text instead of a bare dash

## MODIFIED Requirements

### Requirement: Sidebar ficha metadata card
The sidebar's second card ("Ficha") SHALL render, in a two-column grid: Versión vigente and Publicado (the `fecha` resolved by the shared `getDatosPublicacion(documento)` helper — see "getDatosPublicacion shared publication-data helper" — or "—" if it returns `undefined`); Tipo and Área; Próx. revisión and Confidencialidad; and a "Responsables" block listing autor, revisor, and aprobador, each with `UserAvatar` (photo if `getUser(id)?.avatarUrl` resolves, initials fallback otherwise), the resolved name (`getName`), and their role label in the document. When `revisorId` or `aprobadorId` is absent, that row SHALL show "Sin asignar" in muted text instead of an avatar/name pair.

#### Scenario: Ficha shows versión vigente and publication date
- **WHEN** a `PUBLICADO` document's sidebar renders and `getDatosPublicacion` resolves a `fecha`
- **THEN** "Versión vigente" shows `documento.version` and "Publicado" shows that `fecha`

#### Scenario: Publicado shows a dash when never published
- **WHEN** `getDatosPublicacion(documento)` returns `undefined`
- **THEN** "Publicado" shows "—"

#### Scenario: Responsables show avatar and name
- **WHEN** the document has `autorId`, `revisorId`, and `aprobadorId` all set, and `getUser` resolves all three
- **THEN** each responsable row shows a `UserAvatar` (photo or initials), the resolved name, and a role label

#### Scenario: Missing revisor or aprobador shows Sin asignar
- **WHEN** `documento.revisorId` is not set
- **THEN** the revisor row shows "Sin asignar" in muted text instead of an avatar

#### Scenario: Avatar falls back to initials when no photo or on load failure
- **WHEN** `getUser(id)?.avatarUrl` is absent, or the `<img>` fails to load
- **THEN** `UserAvatar` renders the person's initials instead of a broken image
