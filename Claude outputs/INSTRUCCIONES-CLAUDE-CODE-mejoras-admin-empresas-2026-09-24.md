# Instrucciones para Claude Code — Mejoras en Administración de Empresas

Fecha: 2026-09-24
Autor: Cowork (investigación sobre el código real vía device bridge)
Origen: observaciones de Toño tras probar el módulo Empresas contra el backend .NET real (MSW desactivado).
Change sugerido: `mejoras-admin-empresas`

Ciclo esperado: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.
Las decisiones marcadas `D#` van en el `design.md` como decisiones explícitas. **No las resuelvas en silencio.**

Estado confirmado antes de escribir esto: `openspec/changes/` solo contiene `archive/`, así que no hay ningún change abierto.

---

## Contexto: cómo está hoy el código

Frontend (`shc-controldoc/src/features/empresas/`):

- `EmpresaList.tsx` recibe **todas** las empresas en un solo array (`useEmpresas()` → `GET /api/empresas`) y las pinta en una tabla sin paginación y sin filtros.
- `EmpresaUsuariosPage.tsx` (ruta `/admin/empresas/:id/usuarios`) **sí** pagina en cliente con `components/shared/Pagination.tsx` (`PAGE_SIZE = 10`). Esa página no tiene ningún enlace ni botón para volver a `/admin/empresas`. `PageWrapper` solo recibe `title` y `actions`. En el router, las dos rutas usan el mismo `handle: { breadcrumb: 'empresas' }`, así que el breadcrumb tampoco sirve para volver.
- `EmpresaForm.tsx` / `EmpresaFormModal.tsx` manejan crear y editar. Al editar, `defaultValues.logoBase64 = empresa.logoUrl`, así que el data URI completo del logo se reenvía en cada PATCH aunque no haya cambiado.
- `LogoUploadField.tsx` convierte el archivo a data URI con `FileReader` y lo valida con `validateAvatarFile` (JPEG/PNG, ≤ 2 MB).

Backend (`ShcMvpEndPoint/Features/Empresas/`):

- `ListarEmpresasHandler` (Dapper) hace `SELECT ... logo_url ... FROM empresas ORDER BY razon_social`, sin filtros ni paginación, y devuelve el logo completo de cada empresa.
- `CrearEmpresaHandler` guarda `LogoUrl = command.LogoBase64` directamente.
- `ActualizarEmpresaHandler`: `if (command.LogoBase64 is not null) empresa.LogoUrl = command.LogoBase64;`.
- Todos los endpoints son solo para `SUPERADMIN`.

Patrón de referencia para filtros y paginación en listas: `features/users/components/UserList.tsx` (usa `FilterBar` y `Pagination`, filtra y pagina en cliente). La lista de empresas debe seguir **ese mismo patrón visual y de comportamiento**, no inventar uno nuevo.

---

## 1. Paginación y filtros en la lista de empresas

Implementa en `EmpresaList` (o en `EmpresasAdminPage`, lo que encaje mejor con el patrón de `UserList`):

- Paginación con el componente compartido `Pagination` y `PAGE_SIZE = 10`, igual que `EmpresaUsuariosPage` y `UserList`.
- Filtros con `FilterBar`:
  - búsqueda de texto por **razón social o RUC** (sin distinguir mayúsculas; el RUC puede buscarse por coincidencia parcial);
  - filtro por **estado**: Todas / Activas / Inactivas.
- Al cambiar un filtro, la página vuelve a 1.
- El estado vacío debe distinguir entre "no hay empresas" y "ningún resultado coincide con los filtros".
- Claves i18n nuevas en el namespace `empresas` (es y cualquier otro idioma que ya exista en el proyecto).

**D1 — ¿Paginación y filtros en cliente o en servidor?** Recomendación de Cowork: **en cliente**, igual que Usuarios. El número de empresas en un sistema multi-tenant de este tamaño es bajo, y así el contrato `GET /api/empresas` no cambia. Si Toño prefiere hacerlo en servidor, habría que añadir `search`, `estado`, `page` y `pageSize` al endpoint y cambiar el shape de la respuesta (con los handlers MSW y los tipos TS actualizados en el mismo change). Deja la decisión escrita en `design.md`.

Ojo: con la opción en cliente, la lista sigue trayendo el logo completo de cada empresa (ver punto 4). No es un bloqueante, pero debe quedar mencionado.

## 2. La pantalla "se queda congelada" al actualizar una empresa

Cowork **no** pudo identificar la causa leyendo el código: no hay un bug evidente en `useUpdateEmpresa`, `EmpresaForm`, `ConfirmModal`, `ActualizarEmpresaHandler` ni en el validator, y EF no tiene configurada una estrategia de reintentos que choque con la transacción explícita de la cascada. Por eso este punto es **primero reproducir, después arreglar**:

1. Levanta el backend real y el frontend con `VITE_ENABLE_MSW=false` y entra como `superadmin@shac.dev`.
2. Reproduce los **tres** caminos de actualización por separado:
   a. editar una empresa desde el modal (lápiz) **sin tocar el logo**;
   b. editar una empresa **cambiando el logo**;
   c. desactivar/reactivar desde la lista (`ConfirmModal`), sobre todo **ACTIVA → INACTIVA**, que dispara la cascada RN-EMP-005 con transacción explícita.
3. En cada caso registra en `design.md`: qué request sale (Network), su status y su duración, qué hay en la consola del navegador y en la consola del backend, y qué queda en pantalla. Por ejemplo: el modal no cierra, el botón queda en "Guardando…", el overlay `fixed inset-0` sigue encima o salta el `ErrorBoundary`.
4. Corrige la causa real que encuentres y explica en `design.md` por qué era esa.

Hipótesis a descartar explícitamente (no son conclusiones):

- `EmpresaForm.onSubmit` se traga cualquier error que no sea 409: el `catch` no hace nada, así que el modal queda abierto y el único aviso es el toast del hook. Si el backend devuelve 400/500, al usuario le parece que la app "se congeló".
- El PATCH reenvía el data URI completo del logo en cada edición. Revisa si el tamaño del payload o el tiempo de respuesta tienen algo que ver.
- Tras el éxito, `invalidateQueries` vuelve a traer la lista con todos los logos en base64. Revisa si el re-render es lo que bloquea la UI.
- En la desactivación, la cascada (`ExecuteUpdateAsync` dentro de `BeginTransactionAsync`). Verifica que responde y no deja una transacción colgada.

Pase lo que pase, el form debe mostrar un error visible para cualquier status que no sea éxito, no solo para 409. El modal nunca debe quedar en un estado sin salida.

## 3. No hay forma de volver desde "Usuarios de la empresa"

En `EmpresaUsuariosPage` añade un control para volver a `/admin/empresas`:

- Busca en el proyecto cómo resuelven hoy las páginas de detalle la navegación de vuelta (por ejemplo en Documentos, No Conformidades o Incidentes) y **reutiliza ese patrón**: mismo componente o markup, mismo icono y misma posición. Si no existe ninguno, propón uno en `design.md` y úsalo aquí.
- Debe ser un `Link` a `/admin/empresas`, no `navigate(-1)`: si el usuario entró por deep link, "atrás" no lo llevaría a la lista.
- Si los filtros o la página de la lista de empresas (punto 1) se guardan en estado local, vuelven a sus valores iniciales al regresar. Es aceptable, pero déjalo documentado. Conservarlos (por ejemplo en query params) sería una mejora opcional, no obligatoria.

## 4. ¿Dónde se guardan los logos? (respuesta, más una decisión pendiente)

**Respuesta:** los logos **no se guardan como archivo**. El frontend convierte la imagen a un data URI base64 (`data:image/png;base64,...`) y el backend lo guarda **tal cual** en la columna `logo_url` de la tabla `empresas` (PostgreSQL). El nombre `logo_url` es engañoso: no contiene una URL, contiene la imagen entera. Por contraste, los planos de Locales sí se guardan como archivo en disco vía `PlanoStorageService` (`FileStorage:DocumentosRootPath`).

Consecuencias que Toño debe conocer:

- `GET /api/empresas` devuelve todas las imágenes completas en cada carga de la lista (hasta ~2,7 MB por empresa en base64 si el logo pesa 2 MB).
- Cada PATCH reenvía el logo completo aunque no haya cambiado.
- **Bug encontrado:** "Quitar logo" en el form no funciona contra el backend real. `handleClear` pone `logoBase64 = undefined`, el campo no viaja en el JSON, y el backend interpreta `null` como "no cambiar", así que el logo anterior se queda.

**D2 — ¿Mover los logos a almacenamiento en archivos?** Opciones:
  - (a) **Dejarlo como está** en este change y solo corregir el bug de "Quitar logo".
  - (b) Guardar el archivo en disco con un servicio análogo a `PlanoStorageService`, dejar en `logo_url` una URL o ruta real, y servirlo por un endpoint o por archivos estáticos. Esto cambia el contrato (el frontend deja de mandar base64, o el backend lo decodifica y lo guarda) e implica migrar los logos existentes.

Recomendación de Cowork: **(a)** en este change, y abrir (b) como change propio si Toño lo quiere, porque toca contrato, almacenamiento y migración de datos. **No implementes (b) sin la decisión explícita de Toño.**

**D3 — Contrato para borrar el logo:** hoy no hay forma de expresar "quitar logo" en el PATCH. Propón un contrato explícito, por ejemplo que `logoBase64: ""` (string vacío) signifique borrar, y documéntalo en `design.md`. Aplícalo en el backend (`ActualizarEmpresaHandler`: string vacío → `LogoUrl = null`), en el frontend (`handleClear` / `onSubmit`), en el handler MSW (`empresas.handlers.ts`, `PATCH /api/empresas/:id`) y en los tipos TS. Recomendación adicional: al editar sin tocar el logo, **no reenviar** `logoBase64` (enviar solo los campos cambiados, o al menos omitir el logo si es idéntico al original). Así se reduce el payload y se aísla la hipótesis del punto 2.

---

## Reglas de siempre

- El código real (handlers MSW y tipos TS incluidos) es la fuente de verdad. Si algo de este doc no coincide con lo que encuentres, gana el código, y lo anotas en `design.md`.
- Cualquier cambio de contrato se refleja **a la vez** en backend, handler MSW, tipos TS y tests.
- Corre la **suite completa** de tests del frontend (no solo los archivos tocados) y los tests del backend, además de `tsc`. En esta serie ya aparecieron roturas que solo se vieron en la suite completa.
- Prueba manualmente contra el backend real con MSW desactivado. El punto 2 no se puede validar con MSW.
- Al terminar, Toño relaya "listo". Cowork verificará releyendo el código real y escribirá `SHAC-Verificacion-Mejoras-Admin-Empresas-<fecha>.md`.
