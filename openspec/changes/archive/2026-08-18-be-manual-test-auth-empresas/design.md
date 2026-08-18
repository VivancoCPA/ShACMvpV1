## Context

El backend `ShcMvpEndPoint` (.NET 10 + PostgreSQL, arquitectura VSA) tiene 45 tests automatizados sobre Auth (`Features/Auth/*`) y Empresas (`Features/Empresas/*`), pero todos corren contra el `WebApplicationFactory`/contexto de test (`ShacWebApplicationFactory.cs`), no contra una instancia real con Postgres real en el puerto 5435. El único mecanismo de seed de desarrollo hoy es `DevSeedExtensions.SeedDevelopmentSuperAdminAsync` (`ShcMvpEndPoint.Infrastructure/DevSeed/DevSeedExtensions.cs`), que crea **únicamente** un usuario `SUPERADMIN` (idempotente, solo si `DevSeed:SuperAdminEmail`/`SuperAdminPassword` están configurados). No existe seed de: usuario mono-empresa, usuario multi-empresa, ni usuario deshabilitado — y tampoco existe ningún endpoint de "crear usuario" fuera de `POST /api/empresas/:id/usuarios` (`AsignarUsuarioEmpresa`), que **asigna** un usuario existente a una empresa pero no lo crea desde cero. Esto significa que los usuarios de prueba adicionales deben crearse extendiendo el seed de desarrollo (vía `UserManager<ShacUser>`, igual que hace el seed de SUPERADMIN), no vía un endpoint HTTP de registro que no existe.

El documento de contrato referenciado en las instrucciones originales (`claude/SHAC-Contrato-API-Backend-NET-2026-08-13.md`) no existe en el repo; el contrato real y vigente es `docs/SHAC-Contrato-API.md` (ya modificado en el working tree según `git status`). Este design usa ese archivo como fuente de verdad del contrato a verificar.

## Goals / Non-Goals

**Goals:**
- Verificar los 39 escenarios de los 13 endpoints (7 Auth + 6 Empresas) contra una instancia real corriendo con Postgres real, capturando request/response real de cada uno.
- Cubrir explícitamente RN-EMP-005 (cascada de desactivación `Empresa` → `UsuarioEmpresa`) con datos reales, no solo lectura de código.
- Dejar preparados, de forma no destructiva, los datos de seed necesarios (usuario multi-empresa, y activar/desactivar un usuario existente para el caso `activo: false`) para que esta pasada — y futuras — se puedan repetir.
- Corregir bugs reales encontrados con diagnóstico de causa raíz documentado (mismo patrón que los fixes previos de JWT eager/lazy y HTTPS redirect en tests), nunca en silencio.

**Non-Goals:**
- No se prueban módulos fuera de Auth y Empresas (Incidentes, NC, QE, Dashboard no existen aún en el backend).
- No se automatiza esta pasada como suite de integración — es evidencia manual puntual. Si algún escenario revela un gap de cobertura automatizada real, se anota como hallazgo pero no se convierte automáticamente en un test nuevo dentro de este cambio (salvo que el bug-fix lo requiera para no regresar).
- No se construye un endpoint de "crear usuario" nuevo — es un gap real pero fuera de alcance; se rodea extendiendo el seed de desarrollo.

## Decisions

**Extender `DevSeedExtensions` en vez de crear usuarios vía SQL directo.**
Ya existe el patrón (`SeedDevelopmentSuperAdminAsync`, idempotente, exclusivo de `Development`, usa `UserManager<ShacUser>`). Se agrega un método hermano (p.ej. `SeedDevelopmentTestUsersAsync`) que crea, solo si no existen ya (buscando por email), los usuarios adicionales necesarios: uno mono-empresa activo, uno multi-empresa (con dos filas `UsuarioEmpresa` reales creadas vía el propio endpoint `POST /api/empresas/:id/usuarios` una vez el usuario y las empresas existen), y reutiliza uno de los usuarios de prueba para el caso `activo: false` (editado puntualmente, documentado en el log, revertido o dejado como parte del seed según se documente). Alternativa descartada: insertar filas directo en Postgres con SQL — se descarta porque salta el mismo pipeline de negocio (hashing de password vía Identity, invariantes de `UsuarioEmpresa`) que se busca verificar, y sería inconsistente con cómo ya se sembró el SUPERADMIN.

**Ejecutar los escenarios vía `curl`/Swagger UI, no un runner automatizado nuevo.**
El objetivo es evidencia legible por un humano (Cowork revisándolo por device bridge), no una suite reproducible por CI. `curl` con `-i` (para ver status + headers + body) documentado inline en el `.md` de evidencia es suficiente y evita construir infraestructura de test nueva para un ejercicio de verificación puntual. Alternativa descartada: escribir un script de integración en `ShcMvpEndPoint.Tests` que pegue al servidor real — mezclaría "test automatizado repetible" con "evidencia de una pasada manual puntual", y el objetivo explícito es lo segundo.

**Diagnóstico de causa raíz antes de cualquier fix, igual que el patrón ya establecido para bugs de frontend.**
Si un escenario no coincide con el contrato, el primer paso es identificar el archivo+línea responsable antes de tocar código, y documentarlo en el log de pruebas junto con el fix aplicado. Ningún fix se aplica "a ciegas" solo para hacer pasar el escenario.

**Formato de evidencia: un `.md` con una sección por escenario numerado (1–39), en el mismo orden del proposal.**
Facilita la revisión cruzada por Cowork contra la lista original. Cada sección incluye: comando/request exacto, status code real, body real (completo o resumido si es extenso), veredicto ✅/❌, y — si aplica — diagnóstico + fix.

## Risks / Trade-offs

- **[Risk]** Extender el seed de desarrollo con un usuario multi-empresa y tocar `activo` de un usuario existente podría dejar el entorno de desarrollo local en un estado distinto al que otros flujos manuales asumen. → **Mitigación**: todo cambio de seed es aditivo e idempotente (mismo patrón que el SUPERADMIN existente), documentado explícitamente en el log de pruebas (qué se agregó, con qué email/contraseña), y no se borra ni sobreescribe ningún dato de seed existente.
- **[Risk]** No existe endpoint de "crear usuario" — si el flujo real de M6 backend (cuando exista) crea usuarios de forma distinta a como los crea el seed de desarrollo (p.ej. reglas de validación de password distintas), esta pasada de pruebas no las cubre. → **Mitigación**: fuera de alcance explícito (Non-Goal); se documenta como hallazgo si es relevante.
- **[Risk]** `docs/SHAC-Contrato-API.md` ya aparece modificado en el working tree antes de empezar esta pasada — verificar contra una versión en movimiento podría dar falsos positivos/negativos de discrepancia. → **Mitigación**: al empezar la ejecución, se anota en el log el estado exacto (hash/diff resumen) del contrato contra el que se está verificando, para que Cowork pueda correlacionar el veredicto con la versión correcta del documento.

## Open Questions

- ¿El usuario reutilizado para el caso `activo: false` (escenario 6) debe quedar deshabilitado permanentemente después de la pasada, o debe reactivarse al final para no bloquear otros flujos manuales futuros? Se documentará la decisión tomada en el log de pruebas; por defecto se reactiva al final salvo que Toño indique lo contrario.
