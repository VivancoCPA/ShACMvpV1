## 1. Reproducción del bug "pantalla congelada" (D5) — primero diagnosticar

- [x] 1.1 Levantar backend real y frontend con `VITE_ENABLE_MSW=false`; entrar como `superadmin@shac.dev`
- [x] 1.2 Reproducir (a) editar sin tocar logo, (b) editar cambiando logo, (c) desactivar y reactivar desde `ConfirmModal` (ACTIVA→INACTIVA dispara cascada RN-EMP-005)
- [ ] 1.3 Por cada caso registrar en la tabla de `design.md`: request, status, duración, consola del navegador, consola del backend y qué queda en pantalla (API medida; navegador pendiente en 6.3)
- [ ] 1.4 Descartar explícitamente las 4 hipótesis (catch no-409, payload con logo, re-render tras invalidar, transacción de la cascada) y anotar la causa raíz confirmada (archivo + línea) en `design.md`
- [x] 1.5 Corregir la causa real (front y/o back) y añadir test de regresión

## 2. Contrato de logo (D3) — backend, MSW, tipos y tests a la vez

- [x] 2.1 `ActualizarEmpresaHandler`: `LogoBase64 == ""` → `LogoUrl = null`; `null` → no cambiar; valor → reemplazar. Revisar validator para no rechazar `""`
- [x] 2.2 Tests de backend: quitar logo, omitir logo, reemplazar logo
- [x] 2.3 Handler MSW `PATCH /api/empresas/:id` con la misma semántica (`""` → `logoUrl: ''`/sin logo); `POST` trata `""` como sin logo
- [x] 2.4 `empresaForm.schema.ts` y tipos TS: permitir `logoBase64: ''` y documentar el contrato
- [x] 2.5 `EmpresaForm` (que conoce el logo original) traduce "quitar" a `''`; en edición envía solo campos cambiados y omite `logoBase64` si es igual al original
- [x] 2.6 Tests frontend: quitar logo envía `''`; editar sin tocar logo no incluye `logoBase64`

## 3. Errores visibles en EmpresaForm

- [x] 3.1 `EmpresaForm.onSubmit`: mostrar mensaje de error visible en el modal para cualquier status no exitoso (409 sigue mapeando al campo RUC); el botón se rehabilita y Cancelar siempre funciona
- [x] 3.2 Claves i18n del error genérico en `empresas` (es-PE y en-US)
- [x] 3.3 Test: PATCH 500 deja el modal abierto con error visible y botones operativos

## 4. Paginación y filtros en EmpresaList (D1)

- [x] 4.1 Estado local en `EmpresaList` (o `EmpresasAdminPage`, según encaje con `UserList`): texto, estado (`TODAS`/`ACTIVAS`/`INACTIVAS`), `page`
- [x] 4.2 Filtrado con `useMemo` (razón social o RUC, sin distinguir mayúsculas, RUC parcial) y paginación `PAGE_SIZE = 10` con `Pagination`
- [x] 4.3 `FilterBar` con búsqueda y select de estado; cambiar filtro vuelve a página 1
- [x] 4.4 Estados vacíos diferenciados ("no hay empresas" vs "ningún resultado coincide")
- [x] 4.5 Claves i18n nuevas en `empresas` (es-PE y en-US); light/dark con variantes `dark:`
- [x] 4.6 Tests: filtrado por texto/RUC parcial, filtro de estado, paginación, reset de página, ambos estados vacíos

## 5. Volver desde Usuarios de la empresa (D4)

- [x] 5.1 `EmpresaUsuariosPage`: `Link` a `/admin/empresas` con `ArrowLeft` + texto i18n, mismo markup que las páginas de detalle
- [x] 5.2 Clave i18n en es-PE y en-US
- [x] 5.3 Test: el enlace apunta a `/admin/empresas`

## 6. Verificación

- [x] 6.1 `tsc` sin errores nuevos (queda 1 error preexistente en `IncidentForm.tsx`, ajeno a este change) y suite **completa** de tests del frontend
- [x] 6.2 Suite de tests del backend
- [ ] 6.3 Prueba manual contra backend real con MSW desactivado: los tres caminos de actualización, quitar logo, filtros/paginación y volver desde Usuarios
- [ ] 6.4 Confirmar que D2 (logos como base64, sin migración) quedó documentado y sin implementar; avisar a Toño para que diga "listo" y Cowork verifique
