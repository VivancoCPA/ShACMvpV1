## MODIFIED Requirements

### Requirement: Aviso de solicitudes en el QE con acciones para el JCA
Mientras `qe.solicitudesAC > 0`, el aviso de `QEACSection` visible para `JEFE_CALIDAD_SYST` SHALL indicar que la solicitud se atiende creando la AC con «Nueva AC» o descartándola, y SHALL ofrecer únicamente:
- "Descartar solicitud", que abre un modal con el campo "Motivo del descarte" (20 a 500 caracteres, React Hook Form + Zod) y llama a `useDescartarSolicitudAC`, cuando la sección no es `readOnly`.

El aviso MUST NOT ofrecer un botón propio "Crear AC"; la AC se crea con "Nueva AC" del encabezado de la sección, que abre el mismo formulario de alta y descuenta la solicitud en el servidor.

Crear una AC o descartar una solicitud SHALL invalidar las queries de QE (`['quality-events']`: detalle, lista y AC) y `['dashboard']`, de modo que el aviso, el badge de la lista y RN-QE-009 se actualizan sin recargar. El error `SIN_SOLICITUDES_PENDIENTES` SHALL mostrarse con `t('qualityEvents:errors.SIN_SOLICITUDES_PENDIENTES')`. El audit trail SHALL rotular `SOLICITUD_AC_ATENDIDA` y `SOLICITUD_AC_DESCARTADA`.

#### Scenario: JCA ve solo Descartar en el aviso
- **WHEN** el JCA abre un QE en `EN_INVESTIGACION` con `solicitudesAC = 1`
- **THEN** el aviso muestra "Descartar solicitud" y no "Crear AC", y el encabezado muestra "Nueva AC"

#### Scenario: Crear desde Nueva AC oculta el aviso
- **WHEN** el JCA crea una AC con "Nueva AC" y el QE refrescado devuelve `solicitudesAC = 0`
- **THEN** el aviso desaparece sin recargar

#### Scenario: Descartar oculta el aviso sin recargar
- **WHEN** el JCA descarta con un motivo válido y la API responde 200 con `solicitudesAC = 0`
- **THEN** el aviso desaparece tras la invalidación

#### Scenario: Modal valida el motivo
- **WHEN** el JCA confirma el descarte con un motivo de 5 caracteres
- **THEN** se muestra un error de validación y no se llama al endpoint
