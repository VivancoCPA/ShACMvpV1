## 1. Backend — Turno propio de la NC (D1)

- [x] 1.1 Crear `ShcMvpEndPoint.Domain/Enums/NCTurno.cs` (`TODOS, DIA, TARDE, NOCHE`)
- [x] 1.2 Cambiar `NoConformidad.Turno`, `CrearNoConformidadCommand.Turno` y `ActualizarNoConformidadCommand.Turno` a `NCTurno?` (actualizar comentarios)
- [ ] 1.3 Verificar que EF no detecta cambios de modelo pendientes (sin migración)

## 2. Backend — Errores de binding → 400 (D2)

- [x] 2.1 `ApiExceptionHandler`: mapear `BadHttpRequestException` (con/sin `JsonException` interna) y `JsonException` a 400 con `ApiResponse.Fail` y campo/parámetro; `LogWarning` para esos casos
- [x] 2.2 `Program.cs`: `RouteHandlerOptions.ThrowOnBadRequest = true` en todos los entornos

## 3. Backend — Tests

- [x] 3.1 NC con `turno: "TODOS"` → 201 y el detalle devuelve `TODOS`
- [x] 3.2 NC con `turno: "DIA"` → 201 (regresión)
- [x] 3.3 NC con `turno: "XYZ"` → 400 con mensaje que menciona `turno`
- [x] 3.4 JSON mal formado → 400
- [x] 3.5 Query `?estado=XYZ` → 400 con mensaje que menciona `estado`
- [x] 3.6 `GET /api/nonconformities/abc` → 404
- [x] 3.7 PATCH de turno a `TODOS` persiste el valor
- [ ] 3.8 Correr la suite completa del backend

## 4. Frontend

- [x] 4.1 Util `getServerErrorMessage(error, fallback)` + test
- [x] 4.2 `NCForm.tsx` y `useCreateNonconformity`/`useUpdateNonconformity` usan el mensaje del servidor ante 400
- [x] 4.3 MSW: validar enums en `POST`/`PATCH /api/nonconformities` (400) y aceptar `TODOS`
- [x] 4.4 Test: detalle de NC con `turno: 'TODOS'` muestra "Todos los turnos"
- [x] 4.5 Test: el mensaje del servidor ante 400 se muestra (hooks `useCreateNonconformity`/`useUpdateNonconformity` + util; ver design.md)
- [ ] 4.6 Suite completa de frontend + `tsc --noEmit` + `npm run lint` (cero errores)
