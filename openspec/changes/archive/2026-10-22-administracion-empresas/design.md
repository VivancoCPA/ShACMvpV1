## Context

Módulo Empresas probado contra el backend .NET real (MSW desactivado). Estado del código verificado:

- `EmpresaList` recibe todas las empresas (`GET /api/empresas`, Dapper, `ORDER BY razon_social`, sin filtros ni paginación, con `logo_url` completo) y las pinta sin paginar.
- `EmpresaUsuariosPage` ya pagina en cliente (`PAGE_SIZE = 10`) pero no tiene navegación de vuelta; ambas rutas comparten `handle: { breadcrumb: 'empresas' }`.
- `EmpresaForm.onSubmit` hace `catch` y solo trata 409 (`setRucServerError`); cualquier otro error deja el modal abierto sin mensaje en el form (solo el toast del hook).
- En edición `defaultValues.logoBase64 = empresa.logoUrl`, por lo que el data URI completo se reenvía en cada PATCH.
- `ActualizarEmpresaHandler`: `if (command.LogoBase64 is not null) empresa.LogoUrl = ...`. `LogoUploadField.handleClear` pone `undefined`, el campo no viaja y el backend conserva el logo: "Quitar logo" no funciona.
- Patrones a reutilizar: `UserList` (FilterBar + Pagination en cliente); botón "volver" de `DocumentDetailPage`/`IncidentDetailPage` (`ArrowLeft` + `detail.backToList`).

## Goals / Non-Goals

**Goals:** paginación y filtros en la lista; causa raíz del "congelamiento" confirmada y corregida; navegación de vuelta; contrato explícito de borrado de logo; errores visibles en el form.

**Non-Goals:** mover logos a almacenamiento en archivos (D2); paginación/filtros en servidor; conservar filtros al volver desde Usuarios; cambios en `GET /api/empresas`.

## Decisions

**D1 — Paginación y filtros en cliente.** Igual que Usuarios. El volumen de empresas en un sistema multi-tenant de este tamaño es bajo y el contrato `GET /api/empresas` no cambia. Alternativa (servidor: `search`, `estado`, `page`, `pageSize` + nuevo shape de respuesta, MSW y tipos) descartada por costo sin necesidad actual. Consecuencia conocida: la lista sigue trayendo el logo completo de cada empresa (hasta ~2,7 MB en base64 por empresa). No bloquea, pero es el argumento para reabrir D2 si el volumen crece.

**D2 — Logos siguen como data URI en `logo_url`.** Se guardan tal cual en la columna `logo_url` (PostgreSQL); el nombre es engañoso, no contiene una URL. Contraste: los planos de Locales sí van a disco vía `PlanoStorageService`. Mover a archivos cambia contrato, almacenamiento y exige migración de datos, por lo que **no se implementa en este change y requiere decisión explícita de Toño**; se abriría como change propio.

**D3 — Contrato de borrado de logo.** `logoBase64`: omitido/`null` = no cambiar; `""` = quitar (`LogoUrl = null`); data URI = reemplazar. Alternativa: campo aparte `quitarLogo: bool` (descartada, añade un segundo campo para un solo caso). Además, `EmpresaForm` en edición envía solo campos cambiados y omite `logoBase64` si es idéntico al original, reduciendo payload y aislando la hipótesis del punto 2. Se aplica a la vez en `ActualizarEmpresaHandler`, `LogoUploadField`/`EmpresaForm`, `PATCH` de `empresas.handlers.ts`, `empresaForm.schema.ts`/tipos y tests. En creación, `""` se trata como sin logo.

**D4 — "Volver" con `Link`, no `navigate(-1)`.** Un deep link no tendría historial. Se reutiliza el markup de las páginas de detalle (`ArrowLeft` + texto i18n). Los filtros/página de la lista son estado local y se reinician al volver (aceptado; query params serían mejora opcional).

**D5 — Bug "pantalla congelada": reproducir antes de arreglar.** No se identificó causa leyendo el código. Procedimiento en `tasks.md` (backend real, `VITE_ENABLE_MSW=false`, `superadmin@shac.dev`), tres caminos: (a) editar sin tocar logo, (b) editar cambiando logo, (c) desactivar/reactivar desde `ConfirmModal`, sobre todo ACTIVA→INACTIVA (cascada RN-EMP-005 con transacción explícita). Por cada caso registrar aquí: request, status, duración, consola del navegador y del backend, y qué queda en pantalla. Hipótesis a descartar (no conclusiones): catch que se traga errores no-409; payload con logo completo; re-render tras `invalidateQueries` con todos los logos; transacción colgada en la cascada.

### Registro de reproducción

Reproducción a nivel API contra el backend real (`http://localhost:5072`, PostgreSQL `shac_dev`, login `superadmin@shac.dev`, sobre una empresa de prueba restaurada al terminar). La verificación de pantalla en navegador queda para la prueba manual (tarea 6.3).

| Caso | Request / status / duración | Estado |
|---|---|---|
| Listado inicial | `GET /api/empresas` → 200, 0,20 s, **2,75 MB**, **13.862 empresas** | Datos de prueba acumulados en `shac_dev` |
| a. Editar sin logo | `PATCH` → 200, 0,04 s | Backend correcto |
| b. Editar con logo 1,4 MB base64 | `PATCH` → 200, 0,13 s | Backend correcto |
| c. Desactivar (cascada RN-EMP-005) | `PATCH estado=INACTIVA` → 200, 0,11 s | Backend correcto, sin transacción colgada |
| c'. Reactivar | `PATCH estado=ACTIVA` → 200, 0,02 s | Backend correcto |
| Refetch tras editar | `GET /api/empresas` → 200, 0,07 s, 2,75 MB | Correcto |
| Omitir `logoBase64` | `PATCH` sin campo → 200; el logo de 1,87 MB **se conserva** | Confirma el bug de "Quitar logo" |

**Causa más probable (backend descartado con mediciones; el bloqueo del navegador es inferido y se confirma en la prueba manual 6.3):** el backend no es el problema (todas las operaciones responden en < 130 ms, incluida la cascada). `EmpresaList` renderizaba sin paginar las 13.862 filas de la BD real (cada una con imagen/placeholder, botones y `Link`), y `useUpdateEmpresa.onSuccess` invalida la lista, por lo que tras cada edición o desactivación el navegador volvía a descargar 2,75 MB y a renderizar ~13.8k filas en el hilo principal. El modal parece "congelado" porque el main thread queda bloqueado. Se descartan las otras hipótesis: la cascada no cuelga; el reenvío del logo en el PATCH cuesta 0,13 s en el servidor. Queda como agravante secundario que `EmpresaForm` solo tratara el 409 (sin mensaje visible ante otros errores). La paginación (D1) elimina la causa raíz; se corrigió además el manejo de errores del form y el reenvío del logo (D3).

**Nota:** la BD `shac_dev` acumula ~13.7k empresas `Empresa <hex>` de pruebas automáticas; conviene limpiarla o averiguar quién las inserta (fuera de alcance de este change).

Independientemente de la causa, `EmpresaForm` mostrará un error visible para cualquier status no exitoso y el modal no quedará sin salida.

## Risks / Trade-offs

- [La causa del congelamiento puede no reproducirse] → Si ningún camino falla, documentarlo, aplicar el manejo de errores/payload y pedir a Toño el caso exacto; no cerrar el punto en silencio.
- [Lista con logos base64 pesados] → Aceptado por D1/D2; revisar si D5 muestra que el re-render es el cuello de botella.
- [Cambio de contrato de logo] → Backend, MSW, tipos y tests en el mismo change; un cliente antiguo que omita el campo sigue conservando el logo (compatible).
- [Roturas solo visibles en suite completa] → Correr suite completa frontend, tests backend y `tsc`.
