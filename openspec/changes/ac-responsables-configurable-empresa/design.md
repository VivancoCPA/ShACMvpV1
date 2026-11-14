## Context

`ac-tipo-responsables` centralizó en `ResponsableAcPolicy` la regla "quién puede ser responsable de una AC de tipo X", con la tabla de roles en un `switch` estático (`RolesPermitidos`). La consumen `GetCandidatosAsync` (endpoint de candidatos), `ValidarAsync` (crear AC de QE/NC/incidente y reasignar) y `EsResponsableValidoAsync`. Grep: `RolesPermitidos(tipo)` solo se usa dentro de `BuildQuery`; no hay otros consumidores del método estático.

Ya existe un patrón de configuración por empresa: `sesion-timeout-inactividad` (`Features/SeguridadSesion/SeguridadSesionEmpresa/`, tabla `ConfiguracionSeguridadEmpresa`, auditoría `ConfiguracionSesionAuditTrail` vía `ConfiguracionSesionAuditoria.RegistrarSiCambio`, `SeguridadSesionSection` en `/usuarios`, `SeguridadSesionEmpresaModal` en `/admin/empresas`). Este cambio lo replica.

## Goals / Non-Goals

**Goals:**
- Tabla tipo → roles configurable por empresa, con la tabla de `ac-tipo-responsables` como default.
- Mismas garantías: nunca roles de administración, aislamiento por empresa, auditoría append-only.

**Non-Goals:**
- Reasignar o invalidar AC existentes cuando cambia la regla.
- Configuración por área, por origen del QE o por usuario.
- Que el JEFE_CALIDAD_SYST configure la tabla (lo hacen ADMINISTRADOR_EMPRESA y SUPERADMIN, D2 de Cowork).
- Caché de la configuración.

## Decisions

**D1 — Una fila por (empresa, tipo), `Roles text[]`.** Entidad `ConfiguracionResponsablesAcEmpresa { EmpresaId, Tipo, Roles string[], ActualizadoEn, ActualizadoPorId, ActualizadoPorNombre }`, PK compuesta `(EmpresaId, Tipo)`, `Tipo` como string, FK a `empresas` con cascade, tabla `config_responsables_ac_empresa`. `text[]` porque Npgsql lo mapea nativo y ya se usa en `Incidente.CondicionesEntorno`; JSON no aporta nada para una lista plana. Divergencia menor: se agrega `ActualizadoPorNombre` (no estaba en la instrucción) para alinearse con `ConfiguracionSeguridadEmpresa` y poder mostrar el último cambio sin otra consulta. Sin seed: ausencia de fila = default (`esDefault = true`).

**D2 — `ResponsablesAcDefaults` + `RolesPermitidosAsync`.** La tabla estática se mueve tal cual a `ResponsablesAcDefaults.Roles(tipo)`, junto con `RolesOperativos` (los 6). `ResponsableAcPolicy` sigue dependiendo solo de `DapperConnectionFactory` (la lectura es un `SELECT roles` por PK con Dapper, igual que el resto de la clase — no hace falta inyectar `ShacDbContext`), y expone `RolesPermitidosAsync(empresaId, tipo, ct)`: lee la fila (consulta por PK); si no hay, usa el default; en ambos casos se queda solo con los valores que son roles operativos (filtro defensivo ante filas editadas a mano). Si el filtro deja la lista vacía se respeta (ningún candidato) en vez de volver al default en silencio, para no ocultar un dato corrupto; el PUT nunca permite llegar ahí. `BuildQuery` recibe los roles ya resueltos.
- *Alternativa descartada:* resolver los roles dentro del SQL con un `LEFT JOIN` a la configuración. Más eficiente, pero duplica el default y el filtro de administración en SQL.

**D3 — Endpoints en `Features/AccionesCorrectivas/ConfiguracionResponsables/`.** `GET`, `PUT` y `POST …/restablecer` sobre `/api/empresas/{id:guid}/responsables-ac`, `RequireRole(ADMINISTRADOR_EMPRESA, SUPERADMIN)`. El handler replica `VerificarAccesoAsync` de `SeguridadSesionEmpresaHandler` (ADMIN_EMPRESA solo su empresa activa, si no 404; empresa inexistente 404). Respuesta de los tres: `{ empresaId, tipos: [{ tipo, roles, esDefault }], rolesDisponibles, actualizadoPorNombre?, actualizadoEn? }` (último cambio = fila más reciente). Se implementa restablecer (era opcional) porque deja `esDefault = true` de verdad: un PUT con los defaults crearía filas idénticas pero marcadas como configuradas.

**D4 — Validación del PUT.** `tipos` debe contener exactamente los 3 tipos sin repetir (si no, error en el campo `tipos`); cada `tipos[i].roles` no vacío, sin desconocidos y solo operativos (error en `tipos[i].roles`). Roles repetidos dentro de un tipo se deduplican. Todo vía `FieldValidationException`. Se guarda en orden canónico (el de `RolesOperativos`) para que la comparación anterior/nuevo sea estable.

**D5 — Auditoría: se reutiliza `ConfiguracionSesionAuditTrail`.** Divergencia con la instrucción (que admitía "el mismo mecanismo o uno equivalente"): en lugar de una segunda tabla de auditoría, se agregan filas a la existente con `Ambito = "EMPRESA"`, `EmpresaId`, `Campo = "responsablesAc.{TIPO}"` y `ValorAnterior`/`ValorNuevo` = roles separados por coma (el anterior es el efectivo: el default si no había fila). Motivo: esa tabla ya es append-only genérica (ámbito + campo + valores en texto), así la migración agrega una sola tabla como pide la instrucción. Se agrega a `ConfiguracionSesionAuditoria` una sobrecarga de `RegistrarSiCambio` con valores `string?`. Restablecer registra un cambio por cada tipo cuyo valor efectivo difería del default. Un PUT sin cambios no deja rastro ni toca filas.

**D6 — Efecto solo hacia adelante.** Sin código nuevo: la política ya solo se evalúa al crear o al cambiar `responsableId`. Se cubre con un test de regresión.

**D7 — Frontend.** Nuevo `features/acciones-correctivas/` con `api/responsablesAc.api.ts`, `types/responsablesAc.types.ts`, `hooks/useResponsablesAc.ts` (query `['acciones-correctivas', 'responsables-config', empresaId]`; las mutaciones invalidan esa key y `['acciones-correctivas', 'candidatos']`), `schemas/responsablesAc.schema.ts` (Zod: cada fila con al menos un rol), `components/ResponsablesAcForm.tsx` (matriz con React Hook Form; la usan sección y modal), `ResponsablesAcSection.tsx` y `ResponsablesAcEmpresaModal.tsx`, con estructura y estilos de sus pares de `features/sesion/`. Restablecer pide confirmación con un diálogo en la UI (nunca `confirm()`). La sección se monta en `UsersListPage` bajo `<SeguridadSesionSection />` con la misma condición de rol; el modal, desde una acción nueva por fila en `EmpresasAdminPage`.

**D8 — MSW.** Store en memoria por empresa en `mocks/fixtures/responsablesAc.fixtures.ts` con `getRolesResponsableAC(empresaId, tipo)` (config o default, solo roles operativos). `getCandidatosResponsableAC`/`esResponsableACValido` (y por tanto `validarTipoYResponsableAC`) pasan a usarla. `ROLES_RESPONSABLE_POR_TIPO_AC` queda como tabla de defaults del front, espejo de `ResponsablesAcDefaults`.

**D9 — Divergencias menores surgidas al implementar.**
- Las claves i18n `responsablesAc.*` viven en el namespace `users` (la sección se monta en Usuarios; el modal de Empresas las reutiliza). Se agregaron claves de apoyo que la instrucción no listaba: `tipoColumna`, `guardar`, `guardando`, `cancelar`, `confirmar`, `cargando`, `errorCarga`, `sinCambios`, `accionEmpresa`, `modalTitle`, `cerrar`. Las pistas de `QEACSection` son `qualityEvents:detail.acSection.sinCandidatosAdmin` / `sinCandidatosConsulta`.
- La confirmación de restablecer reutiliza `features/empresas/components/ConfirmModal` (genérico, ya compartido entre empresas y asignaciones) en lugar de un diálogo nuevo.
- La acción por fila en Administración de Empresas usa el ícono `ListChecks`, junto al `ShieldCheck` de seguridad de sesión.
- La pista "Revisa la configuración en Usuarios → …" para ADMINISTRADOR_EMPRESA quedó implementada como pide la instrucción, pero en la práctica no se ve: el ADMINISTRADOR_EMPRESA no tiene acceso a QEs ni al formulario de AC (no es rol operativo). Por eso el test de `QEACSection` cubre solo la rama "Consulta al administrador de tu empresa." que ven los roles operativos.

## Risks / Trade-offs

- [Una empresa deja un tipo sin usuarios reales (p.ej. Mejora = solo JCD y no hay JCD activo)] → el formulario de AC muestra el mensaje con pista; "al menos un rol" no garantiza que existan usuarios con ese rol.
- [La tabla de auditoría de sesión pasa a guardar otro dominio] → el prefijo `responsablesAc.` en `Campo` los distingue; una futura vista de auditoría de sesión debe filtrar por prefijo.
- [Consulta extra por cada validación de responsable] → por PK, barata; aceptado (Non-Goal: caché).

## Migration Plan

1. `dotnet ef migrations add AddConfiguracionResponsablesAc` (solo crea la tabla).
2. Detener backend → `dotnet ef database update` → `dotnet build` → `dotnet run`.
3. Rollback: revertir la migración; sin filas el comportamiento es el de `ac-tipo-responsables`.

## Open Questions

- Ninguna bloqueante. Si Toño quiere que el JEFE_CALIDAD_SYST también configure, se amplía `RequireRole` y la condición de la sección.
