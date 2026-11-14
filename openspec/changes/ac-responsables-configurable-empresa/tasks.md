## 1. Backend — persistencia

- [x] 1.1 Entidad `ConfiguracionResponsablesAcEmpresa` (Domain) + `DbSet` y configuración en `ShacDbContext` (PK compuesta, `Tipo` string, `Roles text[]`, FK cascade a empresas, tabla `config_responsables_ac_empresa`)
- [x] 1.2 Migración `AddConfiguracionResponsablesAc` sin seed; revisar que solo crea la tabla

## 2. Backend — política

- [x] 2.1 `ResponsablesAcDefaults` (tabla actual + `RolesOperativos`)
- [x] 2.2 `ResponsableAcPolicy`: reemplazar `RolesPermitidos` por `RolesPermitidosAsync(empresaId, tipo, ct)` con fallback a defaults y filtro de roles no operativos; `GetCandidatosAsync`/`EsResponsableValidoAsync`/`ValidarAsync` lo usan; grep de otros usos

## 3. Backend — endpoints

- [x] 3.1 Sobrecarga `ConfiguracionSesionAuditoria.RegistrarSiCambio` con valores `string?`
- [x] 3.2 Slice `Features/AccionesCorrectivas/ConfiguracionResponsables/`: DTOs, handler (`Obtener`, `Actualizar`, `Restablecer`, `VerificarAccesoAsync`, validaciones D4, auditoría D5) y endpoint (`GET`/`PUT`/`POST restablecer`, `RequireRole(ADMINISTRADOR_EMPRESA, SUPERADMIN)`)
- [x] 3.3 Registrar handler y endpoint en `EndpointExtensions.cs`

## 4. Backend — tests

- [x] 4.1 Política: defaults sin configuración (regresión), configuración Mejora = solo JCA (candidatos y validación de creación), aislamiento entre empresas, filtro de rol de administración en fila editada a mano
- [x] 4.2 AC existente conserva responsable tras cambio de config; reasignar aplica la regla nueva
- [x] 4.3 PUT: tipo sin roles, rol de administración, tipo faltante → 400; válido → 200 con auditoría por tipo cambiado; PUT sin cambios no audita; restablecer
- [x] 4.4 Permisos: ADMIN_EMPRESA propia 200 / otra 404; SUPERADMIN 200; empresa inexistente 404; JCA 403

## 5. Frontend — datos y MSW

- [x] 5.1 Tipos, `responsablesAc.api.ts`, hooks (`useResponsablesAc`, `useActualizarResponsablesAc`, `useRestablecerResponsablesAc`) con invalidación de candidatos
- [x] 5.2 Fixture en memoria `responsablesAc.fixtures.ts` + handlers `GET`/`PUT`/`POST restablecer` con validaciones y permisos; registrarlos en `handlers/index.ts`
- [x] 5.3 `candidatosUsuarios.ts`: candidatos y validación de `POST` de AC usan la config de la empresa

## 6. Frontend — UI

- [x] 6.1 Schema Zod + `ResponsablesAcForm` (matriz 3×6, badge "Por defecto", error por fila, Guardar deshabilitado, Restablecer con confirmación, nota fija, toast)
- [x] 6.2 `ResponsablesAcSection` en `UsersListPage` (solo ADMINISTRADOR_EMPRESA) y `ResponsablesAcEmpresaModal` + acción en `EmpresasAdminPage` (SUPERADMIN)
- [x] 6.3 `QEACSection`: pista según rol en el mensaje de lista vacía
- [x] 6.4 i18n `es-PE`/`en-US`

## 7. Frontend — tests

- [x] 7.1 Form: matriz con defaults y badge; fila vacía deshabilita Guardar; guardar envía PUT e invalida candidatos; restablecer pide confirmación
- [x] 7.2 Sección no aparece para JCA; modal del SUPERADMIN carga la empresa elegida; MSW de candidatos usa la configuración
- [x] 7.3 `QEACSection`: mensaje de lista vacía según rol

## 8. Verificación

- [x] 8.1 Suite backend completa (`dotnet test`) — 711/711 fuera de Documentos; en Documentos 1 fallo (`ExportarPdfControlado_…`, PdfSharpCore owner password) y 1 cuelgue (`DocumentoPreviewCacheServiceTests.ConLockDeClaveAsync_…`), ajenos a este change
- [ ] 8.2 Suite frontend completa + `tsc --noEmit` + `npm run lint` con cero errores
- [ ] 8.3 Prueba manual con MSW apagado (pasos 1–7 de la instrucción) — la hace Toño tras `dotnet ef database update`
