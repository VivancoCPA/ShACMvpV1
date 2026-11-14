# INSTRUCCIONES PARA CLAUDE CODE — Cierre del QE: firma del Supervisor del área, avisos, rechazo y nombres de los firmantes

- **Fecha:** 2026-11-04
- **Autor:** Cowork (para Toño)
- **Origen:** Toño observó que, al cerrar un QE, después de la firma del Jefe de Calidad se pide la firma de un supervisor, pero en ningún momento se indica quién es el responsable y no se sabe si se le envió el aviso.
- **Change OpenSpec:** `qe-cierre-firma-supervisor-area`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencias:** va después de `incidentes-qe-estado-alertas` (usa `IncidenteQeSync`) y de `qe-precarga-incidente-responsable` (usa `ResponsableInvestigacionId` y el patrón de nombres `[NotMapped]`). Las dos ya están implementadas.
- **Sin migración** de esquema.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 Nadie en particular está designado para la segunda firma

- `Features/QualityEvents/Shared/FirmaCierreResolver.cs` devuelve siempre `UserRole.SUPERVISOR`.
- `FirmarCierreQEHandler` solo exige que el actor tenga ese **rol** y que no sea el mismo usuario que dio la primera firma. **No** valida que el supervisor pertenezca al área del QE: hoy puede firmar cualquier SUPERVISOR de la empresa.
- El PRD §1.5 (P4/P5) habla del "Supervisor del área afectada". `ShacUser` tiene `AreaId` y `AreaIds`, y el dashboard ya resuelve las áreas de un usuario con `DashboardDataFetcher.FetchUsuarioAreaIdsAsync`.

### 1.2 Ningún paso del cierre envía aviso

| Paso PRD §1.5 | Código actual |
|---|---|
| P1 — el QE pasa a PENDIENTE_CIERRE (`CambiarEstadoAccionCorrectivaQEHandler:56–80`, cuando se cierra la última AC) | Solo sincroniza y notifica el **incidente** vinculado. No avisa ni al JCA ni a los supervisores. |
| P3/P4 — primera firma del JCA (`FirmarCierreQEHandler`, rama `qe.CerradoPorId is null`) | Guarda el cambio y hace `return`. **No notifica a nadie.** |
| P5 — el supervisor rechaza | **No existe.** |
| P6 — segunda firma y CERRADO | `NotificarCierreAsync` solo avisa a los JCA, y solo cuando la severidad es ALTA o CRÍTICA. |

Además, `RolNotificationHelper.ResolverDestinatariosPorRolAsync` no filtra `UsuarioEmpresaEstado.ACTIVO`, así que puede notificar a asignaciones inactivas.

### 1.3 La pantalla no muestra quién firmó ni a quién se espera

- `FirmarCierreQEHandler` guarda las firmas en el audit trail con `Accion = "FIRMA_REGISTRADA"` y en `ValorNuevo` pone el **id** del firmante.
- `components/QECierreSection.tsx:164` busca `entry.accion === 'FIRMA_CIERRE_JEFE_CALIDAD'`, una acción que el backend **nunca escribe**. Por eso `firstSignatureEntry` siempre es `undefined` y no se muestra la información de la primera firma.
- No hay ningún texto que diga qué supervisores pueden firmar ni que ya se les avisó.

---

## 2. Decisiones de Toño

- **D1:** la segunda firma la puede dar **cualquier SUPERVISOR activo con el área del QE asignada**. Si el área no tiene ningún supervisor, el cierre queda bloqueado y se avisa al JCA para que asigne uno.
- **D2:** se agregan los avisos de **P1** (PENDIENTE_CIERRE, a JCA y supervisores del área), de **P4** (después de la firma del JCA, a los supervisores del área) y de **P6** (cerrado, a todas las partes).
- **D3:** el supervisor **puede rechazar** el cierre con un comentario obligatorio de 20 a 500 caracteres. El QE vuelve a EN_EJECUCION, se borra la firma del JCA, se avisa al JCA con el motivo y queda registrado en el audit trail.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/Features/QualityEvents/`)

**a) Supervisores del área** (`Shared/SupervisoresAreaResolver.cs`)

- `Task<List<SupervisorArea>> ResolverAsync(ShacDbContext db, Guid empresaId, string areaId, CancellationToken ct)` devuelve los usuarios que cumplen todo esto:
  - asignación en `UsuariosEmpresa` de la empresa, con `Rol == SUPERVISOR` y `Estado == ACTIVO`;
  - `ShacUser.Activo == true`;
  - el área del QE en `AreaIds` o en `AreaId`. Usar el mismo criterio que `FetchUsuarioAreaIdsAsync` y anotarlo en `design.md`.
- Cada resultado es `SupervisorArea(Guid Id, string NombreCompleto, string? AvatarUrl)`.
- Agregar también `EsSupervisorDelAreaAsync(db, empresaId, areaId, usuarioId, ct)`.
- **Corrección incluida:** filtrar `Estado == ACTIVO` en `RolNotificationHelper.ResolverDestinatariosPorRolAsync`.

**b) Validación de la segunda firma** (`FirmarCierreQEHandler`)

- Después de comprobar el rol, si `!EsSupervisorDelAreaAsync(...)`, responder `ForbiddenBusinessException("Solo un supervisor del área {área} puede dar la segunda firma de cierre", "NO_ES_SUPERVISOR_DEL_AREA")` (403).
- Mantener la regla de que el segundo firmante no puede ser quien ya firmó.
- **Bloqueo por área sin supervisor (D1).**
  - **Al iniciar el cierre**: en el handler de `PATCH /:id/cerrar` (`CerrarQEHandler`), antes de guardar `ResultadoCierre`, si `ResolverAsync` devuelve una lista vacía, responder 422 `AREA_SIN_SUPERVISOR` con el mensaje "El área {área} no tiene un supervisor activo asignado. Asigna uno en Usuarios antes de cerrar."
  - **En la primera firma**: validar lo mismo antes de registrarla, por si el supervisor se desactivó en el medio.

**c) Avisos** (`IQualityEventNotificationSender` / `QualityEventNotificationSender`)

Todos los avisos se envían en modo best-effort: después del `SaveChanges`, dentro de `try/catch` con `LogWarning`, nunca al propio actor y sin duplicar destinatarios. El `Link` es siempre `/quality-events/{id}`.

| Método nuevo | Cuándo | Destinatarios | Tipo | Mensaje |
|---|---|---|---|---|
| `NotificarListoParaCierreAsync` | En `CambiarEstadoAccionCorrectivaQEHandler`, cuando el QE pasa a PENDIENTE_CIERRE (y en `TransicionarEstadoQEHandler` si se llega a ese estado por ahí) | JCA activos y supervisores del área | `CAMBIO_ESTADO` | `El {numero} está listo para cierre: todas sus acciones correctivas están cerradas.` |
| `NotificarFirmaSupervisorPendienteAsync` | En la primera firma (rama JCA de `FirmarCierreQEHandler`) | Supervisores del área | `ASIGNACION` | `El {numero} espera tu firma de cierre como Supervisor de {área}. Firmó el Jefe de Calidad {nombreJCA}.` |
| `NotificarCierreRechazadoAsync` | En el rechazo (§3.1d) | El JCA que dio la primera firma; si ya no está activo, todos los JCA | `CAMBIO_ESTADO` | `El supervisor {nombre} rechazó el cierre del {numero}: "{extracto de 100 caracteres}".` |
| `NotificarCierreCompletoAsync` | En la segunda firma (CERRADO) | Reportante (`ReportadoPorId`), responsable de investigación, JCA activos y, si la severidad es ALTA o CRÍTICA, ALTA_DIRECCION | `CIERRE` | `El {numero} fue cerrado con doble firma. Verificación de eficacia programada para el {fecha dd/MM/yyyy}.` |

- `NotificarCierreCompletoAsync` reemplaza a la llamada actual de `NotificarCierreAsync`, que avisa solo a los JCA y solo con severidad ALTA o CRÍTICA. Mantener el método viejo si otros lo usan.
- Para el texto `{área}`, usar el **nombre** del área, no su id.

**d) Rechazo del cierre (D3)**

- Nuevo endpoint `POST /api/quality-events/{id}/rechazar-cierre`, con body `{ motivo: string }` de 20 a 500 caracteres. Va en el slice `RechazarCierreQE`.
- **Validaciones:**
  - un QE de otra empresa responde 404;
  - el estado debe ser PENDIENTE_CIERRE, con la firma del JCA (`CerradoPorId != null`) y sin la del supervisor; si no, 422;
  - el actor debe ser un supervisor del área (§3.1a); si no, 403 `NO_ES_SUPERVISOR_DEL_AREA`;
  - el motivo debe tener entre 20 y 500 caracteres; si no, 400.
  - No pide PIN: rechazar no es firmar. Si se decide pedirlo, anotarlo en `design.md`.
- **Efecto:**
  - `Estado = EN_EJECUCION`;
  - `CerradoPorId = null`;
  - `ResultadoCierre` se **conserva**, para que el JCA lo corrija;
  - `ActualizadoEn = now`.
- **Audit trail:** `CIERRE_RECHAZADO`, con `EstadoAnterior = PENDIENTE_CIERRE`, `EstadoNuevo = EN_EJECUCION`, `ValorNuevo = motivo` y el actor.
- Llamar a `IncidenteQeSync.SincronizarAsync` antes del `SaveChanges`, y a `NotificarCambioAsync` después, con el mismo patrón que los demás handlers. Así el incidente vinculado vuelve a EN_EJECUCION.
- Enviar `NotificarCierreRechazadoAsync`.
- **Cómo se vuelve a PENDIENTE_CIERRE:** el validador ya permite EN_EJECUCION → PENDIENTE_CIERRE. Verificar que `TransicionarEstadoQEHandler` lo permita cuando todas las AC siguen cerradas, para que el JCA pueda avanzar de nuevo sin crear una AC nueva. Si hoy no lo exige, agregar la validación "todas las AC cerradas con evidencia" (RN-QE-003) en esa transición. Anotar en `design.md` lo que se encuentre.

**e) Nombres en el audit trail y en el QE**

- En `FirmarCierreQEHandler`, cambiar las acciones del audit trail por `FIRMA_CIERRE_JEFE_CALIDAD` (primera firma) y `FIRMA_CIERRE_SUPERVISOR` (segunda). En `ValorNuevo` va el **nombre** del firmante. Conservar `CampoModificado` como está.
- Las entradas viejas `FIRMA_REGISTRADA` del QE se quedan como están: el frontend tiene que entender las dos (ver §3.2).
- En `ObtenerQualityEventHandler`, devolver además:
  - `CerradoPorNombre` y `CierreFirmaSupervisorNombre`, con `LEFT JOIN asp_net_users`, como propiedades `[NotMapped]`;
  - `SupervisoresArea: List<SupervisorArea>`. Calcularlo **solo** cuando el estado es PENDIENTE_CIERRE, para que la pantalla muestre quién puede firmar.
  - Calificar con alias todas las columnas del SQL al agregar los JOIN.

### 3.2 Frontend (`shc-controldoc/src/features/quality-events/`)

**a) `components/QECierreSection.tsx`**

- **Firma 1, Jefe de Calidad:**
  - firmada: "✓ {cerradoPorNombre} — {fecha y hora}";
  - pendiente: "Pendiente".
  - La fecha sale de la entrada del audit trail `FIRMA_CIERRE_JEFE_CALIDAD` y, si no existe, de `FIRMA_REGISTRADA` con `campoModificado === 'cerradoPorId'`. Eso corrige la búsqueda rota de la línea 164.
- **Firma 2, Supervisor de {nombre del área}:**
  - firmada: "✓ {cierreFirmaSupervisorNombre} — {fecha}";
  - pendiente, con la firma del JCA ya hecha: "Pendiente. Pueden firmar: {lista de nombres de `supervisoresArea`}", más la nota "Se les envió un aviso".
  - pendiente, sin la firma del JCA: "Se habilita después de la firma del Jefe de Calidad".
- Mostrar el botón "Firmar cierre" solo si `user.rol === 'SUPERVISOR'` **y** el usuario está en `qe.supervisoresArea`. Si es supervisor pero no del área, mostrar: "Solo los supervisores del área {área} pueden firmar este cierre".
- **Rechazar (D3):** junto a "Firmar cierre", agregar el botón secundario "Rechazar cierre". Abre un modal con un textarea de motivo (de 20 a 500 caracteres, con contador) y llama al nuevo `useRechazarCierreQE`. Al tener éxito, invalidar el detalle del QE, su audit trail y los incidentes, igual que hace `useFirmarCierre`.
- **Aviso de rechazo:** si el QE está en EN_EJECUCION y su última entrada relevante es `CIERRE_RECHAZADO`, mostrar arriba de la sección un aviso ámbar: "Cierre rechazado por {nombre} el {fecha}: {motivo}". Es el mismo patrón que el rechazo visible de documentos.
- **`AREA_SIN_SUPERVISOR`:** si el servidor lo devuelve al iniciar el cierre o al dar la primera firma, mostrar el mensaje en la sección. Si el usuario es JCA, agregar un enlace a Usuarios.
- **Hooks:** toda la lógica nueva va antes de cualquier `return` (regla de hooks).

**b) `utils/qualityEventPermissions.ts`:** revisar `resolveRolSegundaFirma(...)`. Puede seguir devolviendo SUPERVISOR, pero la decisión de mostrar los botones se toma con `supervisoresArea` (§3.2a).

**c) Tipos y API:**
- agregar `cerradoPorNombre?`, `cierreFirmaSupervisorNombre?` y `supervisoresArea?: { id; nombreCompleto; avatarUrl? }[]`;
- agregar `rechazarCierre(id, motivo)`.

**d) Audit trail** (`QEAuditTrail.tsx`): agregar las etiquetas de `FIRMA_CIERRE_JEFE_CALIDAD` ("Firma de cierre — Jefe de Calidad"), `FIRMA_CIERRE_SUPERVISOR` ("Firma de cierre — Supervisor") y `CIERRE_RECHAZADO` ("Cierre rechazado").

**e) i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.cierre.firma1` | Firma 1 — Jefe de Calidad | Signature 1 — Quality Manager |
| `detail.cierre.firma2` | Firma 2 — Supervisor de {{area}} | Signature 2 — {{area}} Supervisor |
| `detail.cierre.pendiente` | Pendiente | Pending |
| `detail.cierre.puedenFirmar` | Pueden firmar: {{nombres}} | Can sign: {{nombres}} |
| `detail.cierre.avisoEnviado` | Se les envió un aviso. | They were notified. |
| `detail.cierre.esperaJCA` | Se habilita después de la firma del Jefe de Calidad. | Available after the Quality Manager signs. |
| `detail.cierre.noEsDelArea` | Solo los supervisores del área {{area}} pueden firmar este cierre. | Only {{area}} supervisors can sign this closure. |
| `detail.cierre.rechazar` | Rechazar cierre | Reject closure |
| `detail.cierre.motivoRechazo` | Motivo del rechazo | Rejection reason |
| `detail.cierre.rechazadoAviso` | Cierre rechazado por {{nombre}} el {{fecha}}: {{motivo}} | Closure rejected by {{nombre}} on {{fecha}}: {{motivo}} |
| `errors.AREA_SIN_SUPERVISOR` | El área {{area}} no tiene un supervisor activo asignado. Asigna uno en Usuarios antes de cerrar. | Area {{area}} has no active supervisor. Assign one in Users before closing. |
| `errors.NO_ES_SUPERVISOR_DEL_AREA` | Solo un supervisor del área puede firmar o rechazar este cierre. | Only a supervisor of the area can sign or reject this closure. |

### 3.3 MSW

- El detalle del QE en PENDIENTE_CIERRE devuelve `supervisoresArea` y los nombres de los firmantes.
- `POST /api/quality-events/:id/rechazar-cierre` responde 200, o 403 si el usuario no es supervisor del área.
- Firmar con un supervisor de otra área responde 403 `NO_ES_SUPERVISOR_DEL_AREA`.
- Iniciar el cierre en un área sin supervisores responde 422 `AREA_SIN_SUPERVISOR`.
- Las entradas del audit trail usan las acciones nuevas.

---

## 4. Tests

**Backend**
- `SupervisoresAreaResolver`:
  - incluye a los SUPERVISOR activos con el área asignada;
  - excluye a supervisores de otra área, inactivos (por usuario o por asignación), de otra empresa y de otros roles.
- **Segunda firma:**
  - un supervisor del área → CERRADO;
  - un supervisor de otra área → 403 `NO_ES_SUPERVISOR_DEL_AREA`;
  - el mismo usuario que dio la primera firma → 422, como hoy.
- **Área sin supervisores:** `PATCH /cerrar` → 422 `AREA_SIN_SUPERVISOR`.
- **Avisos:**
  - P1 llega a los JCA y a los supervisores del área (no a supervisores de otras áreas);
  - P4 llega solo a los supervisores del área;
  - P6 llega al reportante, al responsable y a los JCA, y además a ALTA_DIRECCION solo con severidad ALTA o CRÍTICA;
  - ningún aviso le llega al actor;
  - si un aviso falla, la respuesta no cambia.
- **Rechazo:**
  - un supervisor del área con un motivo válido → EN_EJECUCION, `CerradoPorId = null`, `ResultadoCierre` conservado, `CIERRE_RECHAZADO` en el audit, aviso al JCA e incidente sincronizado a EN_EJECUCION;
  - un motivo de menos de 20 caracteres → 400;
  - sin firma del JCA → 422;
  - un supervisor de otra área → 403;
  - un QE de otra empresa → 404.
- **Volver a cerrar después del rechazo:** EN_EJECUCION → PENDIENTE_CIERRE con todas las AC cerradas funciona; con alguna AC abierta, se rechaza (RN-QE-003).
- El audit trail guarda `FIRMA_CIERRE_JEFE_CALIDAD` y `FIRMA_CIERRE_SUPERVISOR` con los nombres, y el detalle devuelve `cerradoPorNombre`, `cierreFirmaSupervisorNombre` y `supervisoresArea`.
- `RolNotificationHelper` ya no incluye asignaciones inactivas.

**Frontend**
- Sección de cierre:
  - firma 1 pendiente → "Pendiente";
  - firma 1 hecha → nombre y fecha, también con la entrada vieja `FIRMA_REGISTRADA`;
  - firma 2 pendiente → "Pueden firmar: …" y "Se les envió un aviso".
- Un supervisor del área ve "Firmar cierre" y "Rechazar cierre"; uno de otra área ve el mensaje y no ve los botones.
- El modal de rechazo exige el mínimo de 20 caracteres. Al rechazar, aparece el aviso ámbar con el motivo.
- `AREA_SIN_SUPERVISOR` se muestra en la sección.

---

## 5. Fuera de alcance

- Los **plazos** del cierre del PRD (5 días hábiles en PENDIENTE_CIERRE y 3 días hábiles para la firma del supervisor) y su escalado.
- El email (P-08).
- Asignar supervisores a un área desde la propia pantalla del QE: se hace en Usuarios, como hoy.

---

## 6. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5. Si un endpoint nuevo responde 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado.** Preparar un área con dos supervisores (A y B) y otra área con un supervisor (C).
  1. Cerrar la última AC de un QE del área 1. El QE pasa a PENDIENTE_CIERRE, y el JCA, A y B reciben "listo para cierre"; C no recibe nada.
  2. Como JCA: registrar el resultado y dar la primera firma con PIN. La sección muestra "Firma 1 ✓ {JCA} {fecha}" y "Firma 2 — Supervisor de {área 1}: Pendiente. Pueden firmar: A, B. Se les envió un aviso". A y B reciben "espera tu firma de cierre".
  3. Como C: ve el mensaje "Solo los supervisores del área…" y no ve los botones.
  4. Como A: rechazar con un motivo. El QE vuelve a EN_EJECUCION, el JCA recibe el aviso con el motivo, la sección muestra el aviso ámbar y el incidente vinculado (si lo hay) vuelve a EN_EJECUCION.
  5. Como JCA: volver a PENDIENTE_CIERRE y firmar de nuevo. Como B: firmar con PIN. El QE queda CERRADO; el reportante, el responsable y el JCA reciben "cerrado con doble firma", y también ALTA_DIRECCION si la severidad es ALTA o CRÍTICA.
  6. Dejar un área sin supervisor activo e iniciar el cierre de un QE de esa área: aparece el mensaje `AREA_SIN_SUPERVISOR`.
- Toño avisa con **"listo"** para que Cowork verifique.
