## Why

Antes de scaffoldear el próximo módulo backend (Incidentes/NC/QE/Dashboard) se necesita confianza real de que Auth y Empresas funcionan de punta a punta contra el backend .NET corriendo de verdad y una base de datos Postgres real — no solo que los 45 tests automatizados (que usan un contexto EF Core en memoria/testing) pasen. Hasta ahora, escenarios críticos como la cascada transaccional RN-EMP-005 (desactivar una empresa desactiva en cascada sus `UsuarioEmpresa`) y el flujo completo de selección de empresa multi-empresa solo se verificaron leyendo el código, nunca ejecutándolos contra datos reales.

## What Changes

- Ejecutar una pasada de pruebas manuales de los 13 endpoints de Auth (7) y Empresas (6) contra el backend real (`docker-compose up -d` + `dotnet run`), cubriendo los 39 escenarios documentados en este proposal (ver capability nueva más abajo), incluyendo casos felices, casos de error (401/403/404/400) y la cascada transaccional RN-EMP-005.
- Preparar los datos de seed de desarrollo necesarios para cubrir los escenarios: confirmar que existan un usuario SUPERADMIN, un usuario mono-empresa activo y un usuario deshabilitado; si no existe, agregar (sin remover nada existente) un usuario con dos empresas asignadas para probar el flujo multi-empresa.
- Documentar cada escenario ejecutado (request exacto, status code real, body de respuesta real, veredicto ✅/❌ contra el contrato) en `docs/PRUEBAS-MANUALES-auth-empresas-2026-08-15.md`.
- Si se detecta un bug real (comportamiento que no coincide con `claude/SHAC-Contrato-API-Backend-NET-2026-08-13.md` secciones 7 y 11), corregirlo con diagnóstico de causa raíz documentado explícitamente en el log de pruebas (mismo patrón usado para los bugs de JWT eager/lazy y HTTPS redirect en tests, ya resueltos anteriormente).

## Capabilities

### New Capabilities

- `backend-auth-empresas-manual-verification`: define los 39 escenarios de verificación manual (contrato de request/response, status codes, side-effects como la cascada RN-EMP-005) que los endpoints de Auth y Empresas del backend real deben cumplir, y el artefacto de evidencia (`docs/PRUEBAS-MANUALES-auth-empresas-2026-08-15.md`) que registra el resultado de ejecutarlos contra una base de datos real.

### Modified Capabilities

Ninguna. Este cambio no introduce ni modifica reglas de negocio nuevas — verifica reglas ya documentadas en `claude/SHAC-Contrato-API-Backend-NET-2026-08-13.md`. Si la ejecución de la pasada de pruebas descubre un bug real y se corrige, esa corrección alinea el código con el contrato ya existente (no es un requisito nuevo) y por eso no requiere una delta spec sobre otra capability.

## Impact

- **Afectado**: `docs/PRUEBAS-MANUALES-auth-empresas-2026-08-15.md` (nuevo). Posiblemente `ShcMvpEndPoint.Infrastructure/DevSeed/` (nuevo usuario multi-empresa de prueba, sin tocar seed existente). Posiblemente código de los endpoints `Features/Auth/*` o `Features/Empresas/*` si se corrige un bug real descubierto durante la pasada.
- **No afectado**: frontend (`ShcMvp` React app), ciclo OpenSpec de módulos futuros, tests automatizados existentes (salvo que un fix de bug requiera actualizar/agregar un test, lo cual se documentaría igualmente en el log).
- **Fuera de alcance**: cualquier escenario no listado en las 39 casos documentados (si se identifica uno relevante durante la ejecución, se agrega marcado explícitamente como "escenario adicional, no solicitado originalmente").
