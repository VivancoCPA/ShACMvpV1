# INSTRUCCIONES PARA CLAUDE CODE — Acciones correctivas: tipo de acción y lista de responsables según el tipo

- **Fecha:** 2026-11-09
- **Autor:** Cowork (para Toño)
- **Origen:** Toño reportó que, al crear una acción correctiva desde un QE, el combo de responsables aparece vacío.
- **Change OpenSpec:** `ac-tipo-responsables`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Lleva migración:** agrega la columna `tipo` a las tres tablas de acciones correctivas.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 El combo sale vacío porque el JCA no tiene permiso sobre `/api/users`

- `shc-controldoc/src/features/quality-events/components/QEACSection.tsx:161` usa `useUsers()` (`features/nonconformities/hooks/useUsers.ts`), que llama a `GET /api/users`.
- En el backend, `Features/Users/ListarUsuarios/ListarUsuariosEndpoint.cs:15–16` exige `RequireRole(ADMINISTRADOR_EMPRESA, SUPERADMIN)`. Para el Jefe de Calidad (o cualquier rol operativo) la respuesta es **403**, `data` queda en el valor por defecto `[]` y el `<select>` (líneas 238–245) muestra solo el placeholder.

### 1.2 Otros lugares con el mismo problema

| Archivo | Uso de `useUsers()` | Síntoma |
|---|---|---|
| `quality-events/components/QEACSection.tsx:527` (panel de ajuste de plazo) | busca el nombre del solicitante | muestra el **id** en lugar del nombre |
| `quality-events/components/QEVerificacionSection.tsx:23,44` | filtra `AUDITOR_INTERNO` para asignar la verificación | la lista de auditores sale vacía |
| `nonconformities/components/NCForm.tsx:94,388` | combo "Detectado por" | sale vacío |
| `nonconformities/components/NCList.tsx:259` | muestra `responsableId` | se ve un id |
| `empresas/components/AsignarUsuarioModal.tsx:31` | pantalla de administración | **correcto**: la usa un administrador; no tocar |

### 1.3 Las AC no tienen tipo y el responsable no se valida

- Las entidades `AccionCorrectivaQE`, `AccionCorrectivaNC` y `AccionCorrectivaIncidente` (`ShcMvpEndPoint.Domain/Entities/`) tienen `Prioridad` y `Estado`, pero **no tienen tipo**. El PRD §2.2 define el "Tipo de acción: Correctiva / Preventiva / Mejora" como obligatorio y no editable.
- `CrearAccionCorrectivaQEHandler.cs:18` busca al responsable con `db.Users.FirstOrDefaultAsync(u => u.Id == command.ResponsableId)`. **No** valida que pertenezca a la empresa ni su rol. Por el id, se puede asignar a un usuario de otra empresa.
- Verificar lo mismo en `Features/NoConformidades/CrearAccionCorrectiva/` y `Features/Incidentes/CrearAccionCorrectiva/`.
- En el frontend, NC e incidentes **no tienen** un formulario para crear AC. Solo lo tiene QE (`QEACSection`).
- El asistente de IA (`qe-asistente-ia`) ya sugiere `tipo` en cada acción (CORRECTIVA, PREVENTIVA o MEJORA), pero hoy ese dato se pierde al crear la AC.

---

## 2. Decisiones de Toño

- **D1:** el responsable de una AC se elige **según el tipo de acción**, con esta tabla:

  | Tipo | Roles que pueden ser responsables |
  |---|---|
  | `CORRECTIVA` | OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION |
  | `PREVENTIVA` | SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION |
  | `MEJORA` | JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION |

  En todos los tipos, el responsable tiene que tener una **asignación ACTIVA en la empresa de la sesión** y el usuario tiene que estar activo. **Nunca** pueden ser responsables ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA ni SUPERADMIN.
- **D2:** se agrega el campo **Tipo** a las AC de QE, NC e incidentes. Es obligatorio al crear y **no editable** (PRD §2.2). Las AC existentes quedan como `CORRECTIVA`.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) Enum y migración**

- Nuevo `ShcMvpEndPoint.Domain/Enums/AccionCorrectivaTipo.cs` con `CORRECTIVA`, `PREVENTIVA` y `MEJORA`.
- Agregar la propiedad `Tipo` a las tres entidades de AC, con `CORRECTIVA` por defecto.
- Migración `AddTipoAccionCorrectiva`: columna `tipo` (texto, la misma convención que los otros enums del proyecto) en `acciones_correctivas_qe`, `acciones_correctivas_nc` y `acciones_correctivas_incidente`, con `defaultValue: "CORRECTIVA"` y `NOT NULL`. Las filas existentes quedan como `CORRECTIVA`.

**b) Política compartida** (`Features/Shared/AccionCorrectiva/ResponsableAcPolicy.cs`, o la carpeta compartida que corresponda)

- `static IReadOnlyList<UserRole> RolesPermitidos(AccionCorrectivaTipo tipo)` con la tabla de D1.
- `Task<bool> EsResponsableValidoAsync(ShacDbContext db, Guid empresaId, AccionCorrectivaTipo tipo, Guid usuarioId, CancellationToken ct)`. Valida que exista una asignación en `UsuariosEmpresa` con esa empresa, `Estado == ACTIVO` y `Rol` incluido en `RolesPermitidos(tipo)`, y que el usuario tenga `Activo`.
- Es la **única** fuente de la regla. El endpoint de candidatos, los tres handlers de creación y el de reasignación (si existe) la usan.

**c) Endpoint de candidatos**

- `GET /api/acciones-correctivas/candidatos-responsable?tipo=CORRECTIVA|PREVENTIVA|MEJORA`, en el slice `Features/AccionesCorrectivas/CandidatosResponsable/` o donde encaje mejor.
- Requiere autenticación y empresa activa (`RequireEmpresaActivaFilter`). Puede llamarlo **cualquier rol operativo**.
- Devuelve `[{ id, nombreCompleto, rol, avatarUrl? }]`: los usuarios de la empresa de la sesión que cumplen la política, ordenados por nombre.
- Un `tipo` inválido o ausente responde 400.

**d) Crear AC** (los tres slices: QE, NC e incidente)

- Agregar `AccionCorrectivaTipo Tipo` al command. Es obligatorio y el validator exige `IsInEnum()`.
- En el handler, si `!EsResponsableValidoAsync(...)`, responder un **error de validación del campo** `responsableId` (400/422, con el mismo patrón que `FieldValidationException`) con el mensaje "El responsable no puede asignarse a una acción de tipo {tipo}". **No** responder 404, aunque el usuario sea de otra empresa: el contrato de validación de campo es el mismo que en RN-DOC-021.
- Guardar `Tipo`. En el audit trail de creación, si ya registra datos de la AC, incluir el tipo.
- **No editable:** los commands de actualizar AC **no** aceptan `Tipo`. Si llega, se ignora.
- **Reasignar responsable:** si existe un endpoint para cambiar el responsable de una AC, aplicar la misma política con el tipo **actual** de la AC.

**e) Lectura:** incluir `tipo` en las respuestas de AC: el detalle de QE, NC e incidente, `ListarAccionesCorrectivasQE`, los resúmenes del dashboard que muestran AC (`AccionCorrectivaResumen`) y la exportación a PDF del QE.

**f) Endpoint de usuarios para selectores que no son de AC**

- Nuevo `GET /api/users/candidatos?roles=AUDITOR_INTERNO,SUPERVISOR,...`. Lo puede usar cualquier rol operativo y devuelve los usuarios activos de la empresa de la sesión con esos roles.
- **Nunca** devuelve roles de administración, aunque se pidan: se filtran en el servidor.
- `GET /api/users` sigue siendo solo para administradores.

### 3.2 Frontend (`shc-controldoc/src/`)

**a) Formulario de AC del QE** (`features/quality-events/components/QEACSection.tsx`)

- Agregar el campo **Tipo de acción**, obligatorio, como un control segmentado o un `select` con Correctiva, Preventiva y Mejora. **Va antes** del responsable.
- Reemplazar `useUsers()` por el nuevo `useCandidatosResponsableAC(tipo)`, con queryKey `['acciones-correctivas', 'candidatos', tipo]`. Mientras no haya tipo, el combo de responsable queda deshabilitado con el texto "Elige primero el tipo de acción".
- Al **cambiar el tipo**, si el responsable elegido no está entre los candidatos nuevos, se limpia y aparece un aviso inline: "{nombre} no puede ser responsable de una acción de tipo {tipo}".
- Mostrar al lado de cada nombre el rol, abreviado o completo (por ejemplo "Ana Pérez · Supervisor").
- Si la lista está **vacía**, mostrar "No hay usuarios activos que puedan ser responsables de este tipo de acción".
- **Desde el asistente de IA:** "Crear AC" precarga `tipo` con el valor sugerido (CORRECTIVA, PREVENTIVA o MEJORA). El tipo sugerido se puede cambiar.
- En la **lista de AC** del QE, mostrar el tipo como un badge pequeño junto a la descripción.

**b) Nombres que hoy salen como id**

- `QEACSection.tsx:527` (solicitante del ajuste de plazo) y `NCList.tsx:259` (responsable): usar el endpoint de nombres que ya existe, `GET /api/users/nombres`, con el hook de nombres del proyecto (`useUserNames`). También sirve que el backend devuelva el nombre en el DTO.
- **Nunca** mostrar un id. Si no hay nombre, mostrar "Usuario no disponible".

**c) Otros selectores**

- `QEVerificacionSection.tsx`: reemplazar `useUsers()` + `filter(AUDITOR_INTERNO)` por `useCandidatosUsuarios(['AUDITOR_INTERNO'])` → `GET /api/users/candidatos?roles=AUDITOR_INTERNO`.
- `NCForm.tsx` ("Detectado por"): `useCandidatosUsuarios` con los roles operativos (OPE, SUP, JCA, JCD, AUD, DIR).
- `AsignarUsuarioModal.tsx` (administración) **queda como está**.
- Verificar con grep que `useUsers()` ya no se use fuera de las pantallas de administración. Si sigue en otro lugar, aplicar el mismo reemplazo y anotarlo en `design.md`.

**d) Tipos e i18n**

- Agregar `tipo: 'CORRECTIVA' | 'PREVENTIVA' | 'MEJORA'` a los tipos de AC de QE, NC e incidente.

| Clave | es-PE | en-US |
|---|---|---|
| `qualityEvents:detail.acSection.fields.tipo` | Tipo de acción | Action type |
| `common:acTipo.CORRECTIVA` | Correctiva | Corrective |
| `common:acTipo.PREVENTIVA` | Preventiva | Preventive |
| `common:acTipo.MEJORA` | Mejora | Improvement |
| `qualityEvents:detail.acSection.placeholders.elegirTipoPrimero` | Elige primero el tipo de acción | Choose the action type first |
| `qualityEvents:detail.acSection.sinCandidatos` | No hay usuarios activos que puedan ser responsables de este tipo de acción. | No active users can own this action type. |
| `qualityEvents:detail.acSection.responsableNoValido` | {{nombre}} no puede ser responsable de una acción de tipo {{tipo}}. | {{nombre}} can't own a {{tipo}} action. |

Si el proyecto no tiene namespace `common`, usar el que se use para textos compartidos.

### 3.3 MSW

- `GET /api/acciones-correctivas/candidatos-responsable?tipo=…` filtra los fixtures de usuarios con la tabla de D1.
- `GET /api/users/candidatos?roles=…` filtra por roles y nunca devuelve administradores.
- `POST` de AC (QE, NC e incidente) exige `tipo`. Con un responsable no permitido para ese tipo, responde un error de validación de `responsableId`.
- Los fixtures de AC incluyen `tipo`.
- `GET /api/users` responde 403 para roles que no son de administración, como el backend real. Así el error no queda oculto en MSW.

---

## 4. Tests

**Backend**
- `ResponsableAcPolicy`: para cada tipo, los roles permitidos aceptan y los demás rechazan. También rechaza usuarios inactivos, asignaciones inactivas, usuarios de otra empresa y administradores.
- Candidatos: `tipo=MEJORA` devuelve solo JCA, JCD y DIR de la empresa. Un tipo inválido devuelve 400. Un JCA puede consultarlo (200).
- Crear AC de QE:
  - `CORRECTIVA` con un OPERARIO → 201;
  - `MEJORA` con un SUPERVISOR → error de validación de `responsableId`;
  - responsable de otra empresa → error de validación;
  - sin `tipo` → 400.
  
  Hacer el mismo set para NC e incidentes.
- Migración: las AC existentes quedan con `tipo = CORRECTIVA`.
- `GET /api/users/candidatos?roles=ADMINISTRADOR_EMPRESA,SUPERVISOR` no devuelve administradores. `GET /api/users` como JCA sigue en 403.

**Frontend**
- Formulario de AC: sin tipo, el combo está deshabilitado. Con `MEJORA` solo aparecen JCA, JCD y DIR. Al cambiar a un tipo que excluye al elegido, el responsable se limpia y aparece el aviso. "Crear AC" desde la IA precarga el tipo.
- Lista de AC: muestra el badge de tipo.
- Ajuste de plazo y NCList: muestran nombres, nunca ids.
- Verificación: la lista de auditores ya no sale vacía para el JCA.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet ef database update`** (hay migración) **→ `dotnet build`** → `dotnet run` → Ctrl+F5. Si un endpoint nuevo responde 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Como JCA, en un QE en EN_INVESTIGACION, hacer clic en "Nueva AC". El responsable está deshabilitado hasta elegir el tipo.
  2. Elegir **Correctiva**: aparecen los usuarios operativos de la empresa, incluidos los operarios, con su rol al lado. Elegir un operario.
  3. Cambiar a **Mejora**: el operario se limpia con el aviso y la lista muestra solo JCA, JCD y DIR. Elegir uno y guardar. La AC aparece con el badge "Mejora" y el responsable recibe su aviso de asignación.
  4. Desde el asistente IA (modo simulado), hacer clic en "Crear AC" en una acción preventiva: el tipo viene en "Preventiva" y la lista muestra SUP, JCA, JCD y DIR.
  5. En una AC con solicitud de ajuste de plazo, el panel muestra el **nombre** del solicitante.
  6. En la verificación de eficacia de un QE, la lista de auditores aparece completa.
  7. En el listado de NC, la columna del responsable muestra el nombre.
- Toño avisa con **"listo"** para que Cowork verifique.
