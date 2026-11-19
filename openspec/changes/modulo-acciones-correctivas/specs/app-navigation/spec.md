## ADDED Requirements

### Requirement: Sidebar incluye ítem de navegación "Acciones correctivas"
`NAV_ITEMS` de `Sidebar.tsx` SHALL incluir el ítem `accionesCorrectivas`, con estas propiedades:
- `to: '/acciones-correctivas'`;
- ícono `ListChecks` de `lucide-react`;
- etiqueta `t('nav:accionesCorrectivas')`;
- `roles`: `['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']`, los mismos que `ROUTE_ROLE_GROUPS.accionesCorrectivas`.

#### Scenario: Visible para los roles operativos
- **WHEN** el usuario tiene rol `OPERARIO` o `JEFE_CALIDAD_SYST`
- **THEN** el ítem "Acciones correctivas" aparece en el sidebar

#### Scenario: Oculto para administración
- **WHEN** el usuario tiene rol `ADMINISTRADOR_EMPRESA`, `ADMINISTRADOR_SISTEMA` o `SUPERADMIN`
- **THEN** el ítem no aparece
