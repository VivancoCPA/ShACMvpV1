# Instrucciones para Claude Code — PIN de firma: poder configurarlo desde la app

Fecha: 2026-10-05
Autor: Cowork (investigación sobre el código real)
Origen: Toño preguntó cuál es el PIN para "Firmar y publicar" un documento y si se puede configurar.
Change sugerido: `pin-firma-ui`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Estado actual (confirmado leyendo el código)

**El backend ya lo resuelve:**
- `POST /api/auth/set-pin` (`Features/Auth/SetPin/`): el usuario autenticado define o cambia **su propio** PIN. Body `{ password, pin }`. Exige la contraseña actual (`CheckPasswordAsync`) y `pin` debe cumplir `^\d{4}$`. Se guarda hasheado en `ShacUser.PinHash` con `IPasswordHasher`.
- `PATCH /api/empresas/{id}/usuarios/{usuarioId}/reset-pin` (`Features/Empresas/ResetPin/`): solo SUPERADMIN. Deja `PinHash = null` si el usuario tiene asignación en esa empresa.
- `FirmarPublicarDocumentoHandler` y la firma de cierre de QE (mismo mecanismo, `FirmarCierreQEHandler`) exigen el PIN. Si `PinHash` es null, responden `BusinessRuleException("Debés configurar tu PIN de firma antes de firmar (POST /api/auth/set-pin)")`. Si el PIN no coincide, `UnauthorizedBusinessException("PIN incorrecto")`, es decir 401.

**Lo que falta en el frontend:**
1. **Ningún componente llama a `set-pin` ni a `reset-pin`.** El usuario no tiene forma de crear su PIN desde la app, así que nadie puede firmar documentos ni cierres de QE contra el backend real. Hoy solo se puede configurar por Swagger.
2. `ProfilePage.tsx` (Mi Perfil) no tiene ninguna sección de PIN.
3. Tampoco hay handler MSW de `set-pin` ni de `reset-pin` en `auth.handlers.ts` / `empresas.handlers.ts`. Es el mismo patrón de bug de toda la serie: con MSW nunca se notó.
4. **`DocumentSignatureModal.tsx` confunde al usuario.** El label dice "Contraseña (PIN de firma)" y el placeholder "Ingresa tu contraseña" (`documents.signature.*` en `es-PE.json`), pero el campo es `maxLength={4}` y el schema exige 4 dígitos. El error ("Credenciales inválidas. Verifica tu contraseña.") también habla de contraseña. Además, `onSubmit` solo reacciona a 401: si el usuario **no tiene PIN**, el error de regla de negocio no aparece en el modal y el usuario no sabe qué pasó.
5. La firma de cierre de QE (`QECierreSection.tsx`, `PinModal`) usa el mismo PIN y tiene el mismo problema cuando el PIN no está configurado.
6. La UI no sabe si el usuario ya tiene PIN: `UserDto` no expone nada al respecto.

## Decisiones

Toño aprobó la solución completa: configurar el PIN en Mi Perfil, resetearlo desde administración y corregir los modales de firma.

**Pregunta abierta para Toño, a dejar escrita en `design.md`:** hoy solo SUPERADMIN puede resetear un PIN. ¿Debería poder hacerlo también el ADMINISTRADOR_EMPRESA dentro de su empresa? **No lo cambies en este change.** Mantén el endpoint como está y regístralo como pregunta abierta.

---

## Qué implementar

### Backend (mínimo)
1. Agrega `tienePinFirma: bool` (calculado como `PinHash != null`) al `UserDto` que devuelven login, refresh y el usuario de sesión, para que la UI sepa si debe pedir configurarlo.
   - Nunca expongas el hash.
   - Revisa todos los lugares que arman `UserDto` y confirma en `design.md` dónde aparece el campo.
2. **Código de error explícito para "sin PIN":** hoy el frontend no puede distinguir "no tiene PIN" de otros errores de regla de negocio. Revisa qué status y qué body produce `BusinessRuleException` en `ApiExceptionHandler`. Luego agrega un código estable (por ejemplo `errorCode: "PIN_NO_CONFIGURADO"`) en firma de documento y firma de cierre de QE, o documenta cómo distinguirlo con lo que ya existe. No te bases en comparar el texto del mensaje.
3. Tests de integración:
   - `set-pin` con contraseña incorrecta → 401;
   - PIN con letras o con 3 dígitos → 400;
   - PIN correcto → después `tienePinFirma = true`;
   - firmar sin PIN → el código de error nuevo;
   - `reset-pin` deja `tienePinFirma = false`.

### Frontend
1. **Mi Perfil → sección "PIN de firma":**
   - Muestra el estado actual: "Configurado" o "No configurado", según `tienePinFirma`.
   - Formulario con **contraseña actual**, **nuevo PIN** (4 dígitos, `inputMode="numeric"`, enmascarado) y **confirmar PIN**.
   - Validación con Zod: 4 dígitos exactos y que ambos PIN coincidan.
   - Llama a `POST /api/auth/set-pin`. Si sale bien: toast, limpia el formulario y actualiza `tienePinFirma` en el auth store. Si responde 401: error en el campo de contraseña.
   - Visible para todos los usuarios, porque cualquier rol elegible puede firmar documentos o cierres de QE.
2. **Modal de firma de documento (`DocumentSignatureModal`):**
   - Cambia los textos i18n a **PIN**: label "PIN de firma (4 dígitos)", placeholder "••••" y error "PIN incorrecto".
   - Campo numérico enmascarado.
   - Si `tienePinFirma === false`, no muestres el campo. Muestra en su lugar el aviso "Aún no configuraste tu PIN de firma" con un enlace a Mi Perfil.
   - Si el backend responde con el código "sin PIN" (por ejemplo, porque se reseteó entre medio), muestra el mismo aviso.
   - Cualquier otro error debe verse en el modal, no solo el 401.
3. **Cierre de QE (`QECierreSection` / `PinModal`):** aplica el mismo tratamiento. Muestra el aviso y el enlace a Mi Perfil cuando no hay PIN, y un error visible para cualquier fallo.
4. **Reset de PIN (SUPERADMIN):** en `EmpresaUsuariosPage` (la lista de usuarios asignados a una empresa), agrega la acción "Resetear PIN" con confirmación. Llama a `PATCH /api/empresas/{id}/usuarios/{usuarioId}/reset-pin` y, si sale bien, muestra un toast que explique que el usuario deberá configurar un PIN nuevo.
5. **MSW:**
   - handler de `set-pin`, que valide la contraseña contra el store mock y guarde el PIN;
   - handler de `reset-pin`;
   - `tienePinFirma` en los usuarios del mock;
   - los handlers de firma (documento y QE) deben validar contra el PIN guardado y devolver el mismo error "sin PIN" que el backend.

   Revisa que no quede ningún PIN fijo tipo `'1234'` en los mocks: ya hubo un bug así en QE.
6. Claves i18n en es-PE y en-US para todo lo anterior.

## Tests
- `ProfilePage`: sección PIN con los estados configurado y no configurado, validaciones (no coinciden, menos de 4 dígitos) y error de contraseña.
- `DocumentSignatureModal` y `PinModal` de QE: sin PIN muestra el aviso y el enlace; PIN incorrecto muestra el error; otro error también se ve.
- `EmpresaUsuariosPage`: la acción "Resetear PIN" llama al endpoint correcto.
- Handlers MSW de `set-pin` y `reset-pin`.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un cambio de contrato (`tienePinFirma`, código de error) se aplica a la vez en backend, MSW, tipos TS y tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  1. Con el aprobador sin PIN, intenta firmar y verifica que aparece el aviso con enlace.
  2. Configura el PIN en Mi Perfil y firma con PIN incorrecto (debe mostrar error) y luego con el correcto: el documento debe quedar PUBLICADO.
  3. Como SUPERADMIN, resetea el PIN de ese usuario y verifica que vuelva a pedir configurarlo.
  4. Repite la firma con un cierre de QE.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
