# INSTRUCCIONES PARA CLAUDE CODE — Configurar por empresa qué roles pueden ser responsables de cada tipo de acción correctiva

- **Fecha:** 2026-11-10
- **Autor:** Cowork (para Toño)
- **Origen:** Toño preguntó dónde se configura la tabla "tipo de AC → roles responsables" de `ac-tipo-responsables`. Hoy está fija en el código, y él decidió que se pueda **configurar por empresa**.
- **Change OpenSpec:** `ac-responsables-configurable-empresa`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** va sobre `ac-tipo-responsables`, que ya está implementado.
- **Lleva migración:** una tabla nueva.

---

## 1. Diagnóstico confirmado leyendo el código

- `ShcMvpEndPoint/Features/AccionesCorrectivas/Shared/ResponsableAcPolicy.cs`:
  - `public static IReadOnlyList<UserRole> RolesPermitidos(AccionCorrectivaTipo tipo)` es un `switch` **fijo** con la tabla de D1 de `ac-tipo-responsables`;
  - `GetCandidatosAsync`, `EsResponsableValidoAsync` y `ValidarAsync` arman la consulta con esos roles (`BuildQuery`).
  - Toda la regla pasa por esta clase, que es el único punto que hay que cambiar en el backend.
- **Patrón que ya existe** para la configuración por empresa: la seguridad de sesión (`sesion-timeout-inactividad`).
  - `Features/SeguridadSesion/SeguridadSesionEmpresa/`, con `GET` y `PUT /api/empresas/{id}/seguridad-sesion`, restringido a `ADMINISTRADOR_EMPRESA` y `SUPERADMIN`;
  - la entidad `ConfiguracionesSeguridadEmpresa`, con una fila por empresa y valor por defecto si no existe;
  - la auditoría de cambios con `ConfiguracionSesionAuditoria.RegistrarSiCambio`;
  - el control de alcance: el ADMIN_EMPRESA solo ve su empresa y cualquier otra responde 404; el SUPERADMIN ve cualquiera.
  - En el frontend, `features/sesion/components/SeguridadSesionSection.tsx` se monta en `features/users/pages/UsersListPage.tsx:16` (Usuarios → Seguridad de sesión), y el SUPERADMIN la edita desde `SeguridadSesionEmpresaModal` en Administración de Empresas.

---

## 2. Decisiones

- **D1 (Toño):** la tabla tipo → roles se configura **por empresa**.
- **D2 (criterio de Cowork, se sigue el patrón de seguridad de sesión):**
  - **Quién configura:** el ADMINISTRADOR_EMPRESA, solo en su empresa, desde **Usuarios → Responsables de acciones correctivas**; y el SUPERADMIN, en cualquier empresa, desde **Administración de Empresas**.
  - **Valor por defecto:** si una empresa no tiene configuración, se usa la tabla actual de `ac-tipo-responsables`.
  - **Validaciones:**
    - cada tipo necesita **al menos un rol**;
    - solo se aceptan roles operativos: OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO y ALTA_DIRECCION;
    - los roles de administración se rechazan siempre.
  - **Efecto:** el cambio aplica **solo a las asignaciones nuevas** (crear AC o reasignar). Las AC que ya existen conservan a su responsable aunque deje de cumplir la regla. La pantalla lo avisa.
  - **Auditoría:** cada cambio queda registrado con quién, cuándo y los valores anterior y nuevo, como en la configuración de sesión.

  Si Toño prefiere otra cosa, como que también configure el JCA, se ajusta en `design.md`.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) Entidad y migración**

- Nueva entidad `ConfiguracionResponsablesAcEmpresa`, con tabla `config_responsables_ac_empresa`. Campos:
  - `EmpresaId` (FK a empresas, **PK compuesta** con `Tipo`);
  - `Tipo` (`AccionCorrectivaTipo`, string);
  - `Roles` (`string[]` en `text[]` de PostgreSQL, igual que otros arrays del proyecto como `CondicionesEntorno`; si se prefiere, JSON);
  - `ActualizadoEn`;
  - `ActualizadoPorId`.
- Migración `AddConfiguracionResponsablesAc`, **sin datos semilla**: una empresa sin filas usa los valores por defecto.

**b) Valores por defecto y lectura** (`Features/AccionesCorrectivas/Shared/`)

- Mover la tabla actual a `ResponsablesAcDefaults.Roles(tipo)`. Es el mismo contenido que hoy tiene `RolesPermitidos`.
- `ResponsableAcPolicy`:
  - **reemplazar** el `static RolesPermitidos(tipo)` por `Task<IReadOnlyList<UserRole>> RolesPermitidosAsync(Guid empresaId, AccionCorrectivaTipo tipo, CancellationToken ct)`. Lee la fila de la empresa; si no hay, devuelve los defaults;
  - `GetCandidatosAsync`, `EsResponsableValidoAsync` y `ValidarAsync` usan esa lectura. El resto de la consulta (asignación ACTIVA, usuario activo, empresa de la sesión) no cambia;
  - buscar con grep cualquier otro uso del método estático y adaptarlo.
- **Filtro defensivo:** aunque la base contenga un rol de administración (por ejemplo, porque se editó a mano), `RolesPermitidosAsync` lo **filtra**.
- Sin caché por ahora: es una consulta por PK y es barata. Si se agrega caché, invalidarla en el `PUT`.

**c) Endpoints** (slice `Features/AccionesCorrectivas/ConfiguracionResponsables/`)

- `GET /api/empresas/{id}/responsables-ac` devuelve `{ tipos: [{ tipo, roles: string[], esDefault: bool }], rolesDisponibles: string[] }`:
  - `esDefault` es true si la empresa no tiene fila guardada para ese tipo;
  - `rolesDisponibles` son los 6 roles operativos.
- `PUT /api/empresas/{id}/responsables-ac`, con body `{ tipos: [{ tipo, roles: string[] }] }`, siempre con los **3 tipos**:
  - **validaciones:** los 3 tipos presentes y sin repetir; cada uno con al menos un rol; solo roles operativos. Cada error se reporta como error de validación del campo (`tipos[i].roles`) con `FieldValidationException`;
  - hace un upsert de las 3 filas;
  - **auditoría:** un registro por tipo que cambió, con el mismo mecanismo de `ConfiguracionSesionAuditoria` o uno equivalente para este módulo. `ValorAnterior` y `ValorNuevo` son las listas de roles en texto.
- Opcional: `POST /api/empresas/{id}/responsables-ac/restablecer`, que borra las filas y vuelve a los defaults, con auditoría.
- **Permisos y alcance:** iguales a `SeguridadSesionEmpresaEndpoint` y su handler, con `RequireRole(ADMINISTRADOR_EMPRESA, SUPERADMIN)`. El ADMIN_EMPRESA solo puede operar sobre la empresa de su sesión; otra empresa responde **404**. El SUPERADMIN puede operar sobre cualquiera, y una empresa inexistente responde 404.

### 3.2 Frontend (`shc-controldoc/src/`)

**a) Componente `ResponsablesAcSection`** (`features/acciones-correctivas/components/`, o junto a `features/sesion/` siguiendo la estructura del proyecto)

- Es una tabla con **3 filas**, una por tipo (Correctiva, Preventiva y Mejora), y **6 columnas** de casillas, una por rol operativo, con la etiqueta i18n del rol.
- Junto a cada tipo, un badge "Por defecto" si `esDefault`.
- **Validación en cliente:** cada fila necesita al menos una casilla. Si no, la fila se marca en rojo y se deshabilita Guardar.
- Botones: **Guardar** y **Restablecer valores por defecto**. Restablecer pide confirmación, y llama al endpoint de restablecer si existe; si no, al `PUT` con los defaults.
- Nota fija debajo de la tabla: "Los cambios aplican a las nuevas asignaciones. Las acciones correctivas existentes conservan a su responsable."
- Al guardar, invalidar `['acciones-correctivas', 'candidatos']` para que los combos tomen la regla nueva.
- Estilo y estructura: los mismos que `SeguridadSesionSection` / `SeguridadSesionForm`.

**b) Dónde se monta**

- En **Usuarios**, `features/users/pages/UsersListPage.tsx`, debajo de `<SeguridadSesionSection />`. Solo la ve el ADMINISTRADOR_EMPRESA, con la misma condición de rol que la sección de sesión.
- En **Administración de Empresas**, para el SUPERADMIN: agregar la acción "Responsables de AC" en la fila de cada empresa. Abre un modal con el mismo componente, como `SeguridadSesionEmpresaModal`.

**c) Formulario de AC** (`QEACSection` y el resto)

- No hay cambios de comportamiento, porque ya pide candidatos por tipo al backend.
- Si la lista sale vacía, el mensaje actual ("No hay usuarios activos que puedan ser responsables de este tipo de acción") se complementa con "Revisa la configuración en Usuarios → Responsables de acciones correctivas", solo si el usuario es ADMIN_EMPRESA. Para otros roles: "Consulta al administrador de tu empresa".

**d) i18n (es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `responsablesAc.title` | Responsables de acciones correctivas | Corrective action owners |
| `responsablesAc.descripcion` | Elige qué roles pueden ser responsables de cada tipo de acción. | Choose which roles can own each action type. |
| `responsablesAc.porDefecto` | Por defecto | Default |
| `responsablesAc.alMenosUno` | Selecciona al menos un rol. | Select at least one role. |
| `responsablesAc.restablecer` | Restablecer valores por defecto | Reset to defaults |
| `responsablesAc.confirmarRestablecer` | ¿Volver a la configuración por defecto? | Restore the default configuration? |
| `responsablesAc.notaAplicacion` | Los cambios aplican a las nuevas asignaciones. Las acciones correctivas existentes conservan a su responsable. | Changes apply to new assignments. Existing corrective actions keep their owner. |
| `responsablesAc.guardado` | Configuración guardada. | Configuration saved. |

Las etiquetas de tipo (`acTipo.*`) ya existen desde `ac-tipo-responsables`.

### 3.3 MSW

- `GET` y `PUT /api/empresas/:id/responsables-ac` en memoria por empresa, con defaults y las mismas validaciones.
- El handler de candidatos (`/api/acciones-correctivas/candidatos-responsable`) usa la configuración en memoria de la empresa activa.

---

## 4. Tests

**Backend**
- Sin configuración: `RolesPermitidosAsync` devuelve los defaults, y los candidatos y la validación funcionan igual que hoy (regresión).
- Con configuración (por ejemplo, Mejora = solo JCA):
  - los candidatos de Mejora devuelven solo JCA;
  - crear una AC de Mejora con un DIR da un error de validación de `responsableId`;
  - **otra empresa sin configuración sigue con los defaults** (aislamiento).
- `PUT`:
  - un tipo sin roles → 400;
  - con `ADMINISTRADOR_EMPRESA` en la lista → 400;
  - faltando un tipo → 400;
  - si todo es válido → 200, con auditoría por cada tipo que cambió.
- **Permisos:**
  - un ADMIN_EMPRESA sobre su empresa → 200; sobre otra → 404;
  - el SUPERADMIN sobre cualquiera → 200;
  - un JCA → 403.
- Una fila editada a mano con un rol de administración: `RolesPermitidosAsync` lo filtra.
- Una AC existente cuyo responsable ya no cumple la regla nueva sigue intacta. Cambiar su responsable sí aplica la regla.

**Frontend**
- La sección muestra la matriz 3×6 con los defaults y el badge "Por defecto".
- Desmarcar todas las casillas de una fila deshabilita Guardar.
- Al guardar se envía el `PUT` y se invalidan los candidatos.
- Restablecer pide confirmación.
- La sección **no** aparece para el JCA.
- El modal del SUPERADMIN abre la configuración de la empresa elegida.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet ef database update`** (hay migración) **→ `dotnet build`** → `dotnet run` → Ctrl+F5. Si un endpoint nuevo responde 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Como ADMINISTRADOR_EMPRESA, en **Usuarios**: debajo de "Seguridad de sesión" aparece "Responsables de acciones correctivas", con la matriz y los tres tipos marcados "Por defecto".
  2. En Mejora, desmarcar ALTA_DIRECCION y guardar. Aparece "Configuración guardada" y el badge "Por defecto" desaparece de esa fila.
  3. Como JCA, en un QE, crear una AC de tipo Mejora: ALTA_DIRECCION ya no aparece en la lista.
  4. Desmarcar todos los roles de Preventiva: Guardar se deshabilita y la fila queda marcada.
  5. Hacer clic en "Restablecer valores por defecto" y confirmar: vuelve la tabla original.
  6. Como SUPERADMIN, en Administración de Empresas → otra empresa → "Responsables de AC": su configuración es independiente.
  7. Como JCA, la sección no aparece en Usuarios.
- Toño avisa con **"listo"** para que Cowork verifique.
