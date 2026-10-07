## 1. Backend — audit trail real

- [x] 1.1 Confirmar (ya hecho en design.md, revalidar si el código cambió) las columnas reales de `documento_audit_trail` en `ShacDbContextModelSnapshot.cs`
- [x] 1.2 Crear el helper compartido de carga de audit trail en `Features/Documentos/Shared/` (uno o varios `documentoId` → filas reales, ordenadas por `timestamp`), proyectando solo columnas que existen en `DocumentoAuditTrail`
- [x] 1.3 `ObtenerDocumentoHandler`: tras los checks de tenant/confidencialidad existentes, poblar `documento.AuditTrail` con el helper
- [x] 1.4 `ListarDocumentosHandler`: mantener `auditTrail: []` cuando `query.Codigo` es `null`; poblarlo (mismo helper, batch) cuando `query.Codigo` está definido (D2)

## 2. Backend — tests de integración

- [x] 2.1 `GET /:id` devuelve `auditTrail` con `DOCUMENTO_CREADO` tras crear
- [x] 2.2 `GET /:id` devuelve `auditTrail` con `ESTADO_CAMBIADO` (`estadoAnterior`/`estadoNuevo`) tras un cambio de estado
- [x] 2.3 `GET /api/documents` sin `codigo` sigue devolviendo `auditTrail: []` por documento
- [x] 2.4 `GET /api/documents?codigo=` devuelve `auditTrail` poblado por cada versión del código

## 3. Frontend — eliminar historialVersiones del contrato

- [x] 3.1 Quitar `VersionEntry` y `Documento.historialVersiones` de `types/documents.types.ts`; `AuditTrailEntry.entidadTipo/entidadId/ipOrigen` pasan a opcionales
- [x] 3.2 Quitar `historialVersiones` del handler MSW `documents.handlers.ts` (create y nueva-versión) y de las ~30 entradas de `mocks/fixtures/documents.fixtures.ts` (mecánico, guiado por `tsc`)
- [x] 3.3 Quitar `historialVersiones: []` de cada test que construye un `Documento` de prueba (guiado por `tsc`/fallos de test)
- [x] 3.4 Quitar el test de `VersionEntry` en `types/documents.types.test.ts`

## 4. Frontend — reconstruir DocumentHistorial desde auditTrail

- [x] 4.1 Reescribir `DocumentHistorial.tsx`: construir las entradas desde `documento.auditTrail` (`DOCUMENTO_CREADO`, `ESTADO_CAMBIADO` con la transición, `FIRMA_REGISTRADA`, y si aporta `NUEVA_VERSION_INICIADA`/`RESTAURADO`), reutilizando las claves i18n `auditTrail.actions.*` ya existentes; timestamps con conversión a hora local (NO el helper de fecha-sin-zona de `fix-fechas-utc` — estos son instantes reales)
- [x] 4.2 Estado vacío cuando `auditTrail` no tiene ninguna acción reconocida (sin crash)
- [x] 4.3 Confirmar que `DocumentAuditTrail.tsx` y `DocumentVersionesTab.tsx` (`getPublisher`) no necesitan cambios más allá de recibir datos reales (ya manejan `[]`)

## 5. Barrido de contrato

- [x] 5.1 Tabla de `design.md` confirmada durante la investigación previa a implementar (no cambió respecto a lo escrito en la propuesta)

## 6. Tests frontend

- [x] 6.1 `DocumentHistorial.test.tsx`: reescrito para un `auditTrail` real (creación + transiciones) y para uno vacío (no crashea, estado vacío) — quitar los casos basados en `historialVersiones`
- [x] 6.2 No existe un test de `DocumentDetailPage` en el repo (ni infraestructura para montarlo completo); cubierto en su lugar por `tsc` limpio (nada referencia `historialVersiones`) + los tests de `DocumentHistorial.test.tsx` que renderizan sin ese campo

## 7. Verificación

- [x] 7.1 Suite completa: backend 480/480; frontend 175 archivos, 1352/1353 (único fallo preexistente `JefeCalidadDashboard.test.tsx`, ya verificado contra baseline en un change anterior); `tsc` solo con el error preexistente de `IncidentForm.tsx:377`, sin relación
- [x] 7.2 Backend detenido (mi propia instancia de diagnóstico) y recompilado limpio antes de la prueba manual
- [x] 7.3 Prueba manual con MSW apagado, dos vías:
  - En vivo en el navegador (tu propia sesión, documento PRC-CD-011): "Enviar a revisión" en un documento real → Historial de estados se actualizó al instante con "Cambio de estado: BORRADOR → EN_REVISION", ordenado sobre "Documento creado"; sin crash. Audit Trail y fechas de Vigencia/Próx. Revisión también correctos.
  - Flujo completo BORRADOR → EN_REVISION → EN_APROBACION → firma (PIN) → PUBLICADO vía API, en una empresa y usuarios de prueba propios (aislados, no toqué tu sesión): confirmado que `GET /:id` devuelve las 7 entradas reales de auditTrail; `GET ?codigo=` también las devuelve y `getPublisher()` resuelve el nombre real de quien firmó ("QA SinEmpresa"); el listado general sin `codigo` sigue devolviendo `auditTrail: []` — los tres criterios de D2 confirmados con datos reales, no solo con tests
- [x] 7.4 Retomado: confirmadas contra Postgres real las filas pendientes de `design.md` de `fix-fechas-utc` (NC, `AccionCorrectivaNC`, `reporteExternoRef` de QE — todas `201` sin 500). Tarea 6.3 de `documentos-revisor-aprobador-reales` sigue pendiente de que Toño la retome (requiere su propia sesión/usuarios reales)
- [ ] 7.5 Avisar a Toño ("listo"); Cowork verifica releyendo el código real y escribe `SHAC-Verificacion-Fix-Detalle-Documento-<fecha>.md`
