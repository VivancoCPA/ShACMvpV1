## 1. Entorno

- [ ] 1.1 Levantar `docker-compose up -d` (Postgres en puerto 5435) y confirmar que el contenedor está healthy.
- [ ] 1.2 Correr la API (`dotnet run` o `dotnet watch run` en `ShcMvpEndPoint`) y confirmar que `dotnet ef database update` no deja migraciones pendientes.
- [ ] 1.3 Confirmar que Swagger carga en `/swagger` y que el botón "Authorize" acepta un `accessToken` y lo adjunta a llamadas subsiguientes.
- [ ] 1.4 Anotar en el log de evidencia (`docs/PRUEBAS-MANUALES-auth-empresas-2026-08-15.md`) el estado exacto de `docs/SHAC-Contrato-API.md` contra el que se está verificando (ya aparece modificado en el working tree — ver design.md, sección Risks).

## 2. Datos de seed

- [ ] 2.1 Confirmar en `ShcMvpEndPoint.Infrastructure/DevSeed/DevSeedExtensions.cs` y en la base de datos real qué usuarios/empresas ya existen (hoy solo hay seed de un usuario `SUPERADMIN`).
- [ ] 2.2 Si no existe, crear un usuario mono-empresa activo y una empresa a la que asignarlo (vía `POST /api/empresas` + `POST /api/empresas/:id/usuarios`, o extendiendo el seed de desarrollo).
- [ ] 2.3 Crear (extendiendo `DevSeedExtensions` de forma aditiva e idempotente, sin tocar el seed de SUPERADMIN existente) un usuario con dos empresas asignadas para el flujo multi-empresa; asignarle rol distinto en cada empresa para poder verificar el escenario 3 del login.
- [ ] 2.4 Identificar o crear un usuario para el caso `activo: false` (escenario 6); documentar en el log si se reutiliza uno existente y si se reactiva al final de la pasada (ver Open Question en design.md).
- [ ] 2.5 Documentar en el log de evidencia exactamente qué se agregó al seed de desarrollo (emails, empresas, roles) para que quede trazable.

## 3. Auth — ejecución de escenarios (1–23)

- [x] 3.1 `POST /api/auth/login` — ejecutar y registrar los 8 escenarios (1–8: mono-empresa, multi-empresa sin empresaId, multi-empresa con empresaId, superadmin, credenciales inválidas, usuario deshabilitado, sin empresa asignada, empresaId no autorizado).
- [x] 3.2 `POST /api/auth/logout` — ejecutar y registrar los 2 escenarios (9–10: token válido, sin token/token inválido).
- [x] 3.3 `POST /api/auth/refresh` — ejecutar y registrar los 2 escenarios (11–12: token válido, token inválido/expirado).
- [x] 3.4 `POST /api/auth/switch-empresa` — ejecutar y registrar los 5 escenarios (13–17: cambio válido, sin empresaId, token inválido, superadmin intenta cambiar, empresaId no asignado).
- [x] 3.5 `POST /api/auth/forgot-password` — ejecutar y registrar los 2 escenarios (18–19: email existente, email inexistente), confirmando que ambas respuestas son indistinguibles.
- [x] 3.6 `POST /api/auth/reset-password` — ejecutar y registrar los 2 escenarios (20–21: token válido, token inválido/expirado).
- [x] 3.7 `POST /api/auth/change-password` — ejecutar y registrar los 2 escenarios (22–23: currentPassword correcto, currentPassword incorrecto).

## 4. Empresas — ejecución de escenarios (24–39)

- [x] 4.1 `GET /api/empresas` — ejecutar y registrar los 3 escenarios (24–26: SUPERADMIN, no-SUPERADMIN, sin sesión).
- [x] 4.2 `POST /api/empresas` — ejecutar y registrar los 2 escenarios (27–28: creación válida, RUC duplicado — documentar el status code real si no está especificado en el contrato).
- [x] 4.3 `PATCH /api/empresas/:id` — ejecutar y registrar los 3 escenarios (29–31), con especial atención al escenario 30 (cascada RN-EMP-005): verificar con un `GET /api/empresas/:id/usuarios` posterior que todas las filas `UsuarioEmpresa` activas de esa empresa quedaron en `INACTIVO`.
- [x] 4.4 `GET /api/empresas/:id/usuarios` — ejecutar y registrar los 2 escenarios (32–33: usuarios activos e inactivos, empresa inexistente).
- [x] 4.5 `POST /api/empresas/:id/usuarios` — ejecutar y registrar los 3 escenarios (34–36), con especial atención al escenario 35: reasignar al usuario desactivado en cascada en el paso 4.3 y confirmar con un GET que la fila se reactivó (rol actualizado) en vez de duplicarse.
- [x] 4.6 `PATCH /api/empresas/:id/usuarios/:usuarioId` — ejecutar y registrar los 3 escenarios (37–39: desactivar puntual, reactivar puntual, par inexistente).

## 5. Bugs encontrados (si aplica)

- [x] 5.1 Para cada discrepancia ❌ encontrada: diagnosticar causa raíz (archivo + línea) antes de tocar código, según el patrón de "Diagnóstico antes de fix". (Ninguna discrepancia real encontrada — los 39/39 escenarios pasaron.)
- [x] 5.2 Aplicar el fix, re-ejecutar el escenario afectado y confirmar que ahora coincide con el contrato. (N/A — sin bugs que corregir.)
- [x] 5.3 Documentar en el log de evidencia, para cada bug: diagnóstico, archivo(s) modificado(s), y el resultado de la re-ejecución. (Documentado explícitamente que no hubo bugs, ver sección 4 del log.)
- [x] 5.4 Correr `dotnet test` para confirmar que los 45 tests automatizados existentes siguen en verde tras cualquier fix. (45/45 ✅, tras los cambios de seed en `Program.cs`/`DevSeedExtensions.cs`.)

## 6. Cierre

- [x] 6.1 Completar el archivo `docs/PRUEBAS-MANUALES-auth-empresas-2026-08-15.md` con los 39 escenarios (y cualquier escenario adicional, marcado explícitamente como "no solicitado originalmente"). (Sin escenarios adicionales — se cubrieron exactamente los 39 solicitados.)
- [x] 6.2 Escribir el resumen final: cuántos escenarios ✅, cuántos ❌, y de los ❌ cuáles se corrigieron vs. cuáles requieren una decisión de Toño. (39/39 ✅, 0 ❌ — ver sección 5 del log.)
- [x] 6.3 Revertir el estado del usuario usado en el escenario 6 (`activo: false`) si se decidió reactivarlo al cierre (ver Open Question en design.md), y documentar la decisión tomada. (N/A — se creó un usuario QA nuevo ya inactivo, no se reutilizó ninguno existente; no hay nada que revertir. Documentado en sección 5 del log.)
- [x] 6.4 Correr `git status` y confirmar que no hay commits nuevos (salvo pedido explícito de Toño). (Confirmado — working tree con cambios sin commitear, ningún commit nuevo creado.)
