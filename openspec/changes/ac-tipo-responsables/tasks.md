## 1. Backend — dominio y migración

- [x] 1.1 Crear `ShcMvpEndPoint.Domain/Enums/AccionCorrectivaTipo.cs` (`CORRECTIVA`, `PREVENTIVA`, `MEJORA`)
- [x] 1.2 Agregar `Tipo` (default `CORRECTIVA`) a `AccionCorrectivaQE`, `AccionCorrectivaNC`, `AccionCorrectivaIncidente`
- [x] 1.3 Configurar `HasConversion<string>().HasMaxLength(20).HasDefaultValue(CORRECTIVA)` en `ShacDbContext` para las tres entidades
- [x] 1.4 Generar migración `AddTipoAccionCorrectiva` (NOT NULL, default `'CORRECTIVA'`) y revisar el SQL

## 2. Backend — política y endpoints de candidatos

- [x] 2.1 `Features/AccionesCorrectivas/Shared/ResponsableAcPolicy.cs` (RolesPermitidos, GetCandidatosAsync, ValidarAsync) + registro en DI
- [x] 2.2 `Features/AccionesCorrectivas/CandidatosResponsable/` → `GET /api/acciones-correctivas/candidatos-responsable?tipo=` (400 si tipo inválido) + mapeo en el registro de endpoints
- [x] 2.3 `Features/Users/CandidatosUsuarios/` → `GET /api/users/candidatos?roles=` (filtra admins, 400 si rol inválido/lista vacía) + mapeo

## 3. Backend — crear y actualizar AC

- [x] 3.1 QE: `Tipo` nullable en command + validator `NotNull().IsInEnum()`; handler valida con la política, usa el nombre del candidato, guarda `Tipo`, audit `AC_CREADA` con el tipo, notifica asignación (best-effort)
- [x] 3.2 NC: mismo cambio en `NoConformidades/CrearAccionCorrectiva`
- [x] 3.3 Incidente: mismo cambio en `Incidentes/CrearAccionCorrectiva`
- [x] 3.4 Los tres `ActualizarAccionCorrectiva*`: si cambia `ResponsableId`, validar con el `Tipo` actual
- [x] 3.5 Dashboard: `Tipo` en `AcUnificada` y `AccionCorrectivaResumen`

## 4. Backend — tests

- [x] 4.1 Tests de `ResponsableAcPolicy` (por tipo, inactivo, asignación inactiva, otra empresa, admin)
- [x] 4.2 Tests de candidatos-responsable (MEJORA, tipo inválido 400, JCA 200)
- [x] 4.3 Tests de crear AC en QE, NC e incidente (CORRECTIVA+OPERARIO 201, MEJORA+SUPERVISOR 400, otra empresa 400, sin tipo 400)
- [x] 4.4 Test de reasignación con rol no permitido
- [x] 4.5 Tests de `/api/users/candidatos` (filtra admins, 400 rol inválido) y `GET /api/users` como JCA → 403
- [x] 4.6 Ajustar tests existentes que crean AC sin `tipo` o con responsables no elegibles

## 5. Frontend — tipos, API, hooks, i18n

- [x] 5.1 `AccionCorrectivaTipo` + `tipo` en tipos de AC de QE, NC e incidente (y en `AccionCorrectivaResumen` del dashboard)
- [x] 5.2 API + hook `useCandidatosResponsableAC(tipo)` (`['acciones-correctivas', 'candidatos', tipo]`)
- [x] 5.3 API + hook `useCandidatosUsuarios(roles)` (`['users', 'candidatos', roles]`)
- [x] 5.4 Claves i18n `es-PE`/`en-US` (`common:acTipo.*`, `qualityEvents:detail.acSection.fields.tipo`, `placeholders.elegirTipoPrimero`, `sinCandidatos`, `responsableNoValido`, roles abreviados si faltan)

## 6. Frontend — componentes

- [x] 6.1 `createQEAccion.schema.ts`: `tipo` obligatorio
- [x] 6.2 `AgregarQEACModal`: select de tipo antes del responsable, responsable dependiente del tipo con rol, deshabilitado sin tipo, limpieza + aviso al cambiar, mensaje sin candidatos, error de servidor en `responsableId`
- [x] 6.3 `QEInvestigationSection`: "Crear AC" precarga `tipo` sugerido por la IA
- [x] 6.4 `QEACSection`: badge de tipo en la lista; `AjustePlazoPanel` con `useUserNames`
- [x] 6.5 `QEVerificacionSection` → `useCandidatosUsuarios(['AUDITOR_INTERNO'])`
- [x] 6.6 `NCForm` "Detectado por" → `useCandidatosUsuarios` con roles operativos
- [x] 6.7 `NCList` → `responsableNombre` con fallback "Usuario no disponible"
- [x] 6.8 PDF del QE: columna Tipo en la tabla de AC
- [x] 6.9 grep: `useUsers()` solo en pantallas de administración; eliminar `features/nonconformities/hooks/useUsers.ts` si queda sin uso

## 7. MSW

- [x] 7.1 Handler `GET /api/acciones-correctivas/candidatos-responsable` (+ registrar en index)
- [x] 7.2 Handler `GET /api/users/candidatos` (antes de cualquier `/api/users/:id`)
- [x] 7.3 `GET /api/users` → 403 para roles no administrativos
- [x] 7.4 `POST` de AC en QE, NC e incidente: exigir `tipo`, validar responsable con la política, guardar `tipo`
- [x] 7.5 Fixtures de AC con `tipo: 'CORRECTIVA'`

## 8. Frontend — tests

- [x] 8.1 Modal: sin tipo deshabilitado; MEJORA solo JCA/JCD/DIR; cambio de tipo limpia + aviso; precarga IA
- [x] 8.2 Lista de AC muestra badge de tipo
- [x] 8.3 Ajuste de plazo y NCList muestran nombres
- [x] 8.4 Verificación: lista de auditores no vacía para el JCA
- [x] 8.5 Tests de handlers MSW (candidatos, 403 de /api/users, POST sin tipo / responsable no permitido)

## 9. Verificación

- [ ] 9.1 Suite backend completa (`dotnet test`)
- [ ] 9.2 Suite frontend completa + `tsc --noEmit` + `npm run lint` con cero errores
- [x] 9.3 Registrar divergencias en `design.md`
