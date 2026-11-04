# SHAC / AppCoDoc — Handoff de contexto (2026-10-20)

> **Para el Claude que lee esto:** eres **Cowork** en el proyecto SHAC de Toño. Lee este documento completo antes de responder. Reemplaza al handoff anterior (`claude/SHAC-Contexto-Handoff-2026-09-23.md`). Las instrucciones de cada change están en el Project como `claude/INSTRUCCIONES-CLAUDE-CODE-*.md`, y el PRD vigente es `claude/SHAC_PRD_v1.1.md`.

---

## 1. Qué es SHAC

- Sistema **multi-empresa** de gestión de calidad y SST (ISO 9001:2015 e ISO 45001:2018) para un operador logístico de almacén de minerales en Perú.
- **Módulos:**
  - M1 Control Documentario
  - M2 No Conformidades
  - M3 Incidentes SyST (PWA offline)
  - M4 Quality Event
  - M5 Dashboard
  - M6 Usuarios y Roles
  - Administración de Empresas, Locales y Áreas
- **Estado general:** el cutover desde MSW al backend real .NET está **hecho en todos los módulos**. La **etapa de verificación de M1 Documentos quedó cerrada** (13-oct-2026), con el PRD actualizado a la v1.1.

## 2. Método de trabajo fijo (3 roles), no cambiarlo

1. **Cowork** (tú) investiga el **código real** por el puente con la PC de Toño y escribe **solo instrucciones en prosa** para Claude Code. **Nunca** escribe `proposal.md` ni código de producción.
2. **Claude Code** implementa con OpenSpec: `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`.
3. Cuando Toño dice **"listo"**, **Cowork verifica** releyendo el código real y, si corresponde, escribe `SHAC-Verificacion-*.md`.

**Reglas permanentes:**

- El código real (handlers, tipos TS, MSW) es la fuente de verdad, por encima de los documentos.
- Las ambigüedades se le plantean a Toño como decisiones **D1, D2…**, con opciones y una recomendación (usa AskUserQuestion). Se espera su respuesta antes de escribir el `.md`.
- Toño suele pedir primero **opciones o sugerencias, y que no se genere el `.md` todavía**. Respeta esa secuencia.
- **Multi-empresa:** el `empresaId` sale siempre de la sesión. Cualquier acceso a otra empresa responde **404**, nunca 403.
- **Hosting y dominio de producción: diferido por decisión de Toño.** No lo empujes.

**Forma de entregar cada instrucción (preferencia explícita de Toño):** siempre como archivo `.md`:

1. Escribirlo en `/mnt/user-data/outputs/`.
2. Hacer commit a `C:\Users\ANTONIO\source\repos\OpenSpec\ShcMvp\Claude outputs\`.
3. Guardarlo en el Project con `project_write` en `claude/<nombre>.md`. Primero copiarlo a `/home/claude/` y usar `local_path`, porque `local_path` fuera del directorio de trabajo falla.

Nombre: `INSTRUCCIONES-CLAUDE-CODE-<change>-<AAAA-MM-DD>.md`.

**Formato del `.md`:**

- Encabezado: fecha, autor, origen y nombre del change.
- Diagnóstico confirmado leyendo el código.
- Decisiones de Toño.
- Qué implementar (backend, frontend y MSW).
- Tests.
- "Reglas de siempre":
  - divergencias en `design.md`;
  - suite completa + `tsc`;
  - **detener el backend → `dotnet ef database update` si hay migración → `dotnet build`** antes de la prueba manual;
  - prueba manual con MSW apagado;
  - Toño avisa con "listo".

## 3. Entorno técnico

- **Repo local de Toño:** `C:\Users\ANTONIO\source\repos\OpenSpec\ShcMvp\`, con:
  - `shc-controldoc/`: frontend con React, TypeScript, Vite, TanStack Query, Zustand, RHF + Zod, MSW, i18n es-PE/en-US y Tailwind con tokens propios (`canvas`, `surface-card`, `hairline`, `coral`, `ink`, `body`, `muted`…).
  - `ShcMvpEndPoint/`: .NET 10 con vertical slices `Features/<Mod>/<Accion>`, CQRS (lecturas con Dapper y escrituras con EF Core), PostgreSQL en el puerto **5435** con docker-compose, JWT + refresh token rotativo en cookie httpOnly, SignalR `/hubs/notifications` y CORS `ShacFrontend`.
  - `openspec/changes/`, `Claude outputs/` y `CLAUDE.md`.
- Backend en `http://localhost:5072`. Las dos partes corren en el mismo VS Code.
- **Herramientas del puente:**
  - `mcp__remote-devices__device_bash` **funciona** (shell sobre `$HOME/mnt/ShcMvp`). Es lo preferido para leer y buscar.
  - `device_stage_files` y `device_commit_files` sirven para traer archivos y para entregar los `.md`.
- **LibreOffice** está instalado. Se configura en `appsettings.Development.json` → `"PdfConversion": { "SofficePath": "C:\\Program Files\\LibreOffice\\program\\soffice.exe" }`. Va en su propia sección, **no** dentro de `ConnectionStrings`; ese error ya ocurrió una vez.
- **Credenciales de desarrollo:**
  - `superadmin@shac.dev` / `SuperAdminDevLocal_2026!`
  - usuarios de QA (`mono.qa`, `multi.qa`, `sin.empresa.qa`, `inactivo.qa`) / `QaTest_2026!`
- **Gotchas recurrentes:**
  - **Un 404 en un endpoint recién creado casi siempre es un backend viejo corriendo.** En Windows, el DLL queda bloqueado. Solución: detener el proceso, `dotnet ef database update`, `dotnet build`, `dotnet run` y Ctrl+F5. Si persiste, cerrar el `ShcMvpEndPoint.exe` que quedó colgado. Pasó con `candidatos-asignacion` y con `parametros-sesion`.
  - Npgsql rechaza un `DateTime` con Kind=Unspecified en `timestamptz` (resuelto con el convertidor global a UTC).
  - CORS no exponía `Content-Disposition` (resuelto).
  - Los archivos `.env` no se pueden commitear con el puente: hay que darle el contenido a Toño para que los cree él.

## 4. Roles

- **Roles globales:** OPE (OPERARIO), SUP (SUPERVISOR), JCA (JEFE_CALIDAD_SYST), JCD (JEFE_CONTROL_DOCUMENTARIO), AUD (AUDITOR_INTERNO), DIR (ALTA_DIRECCION), ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA y SUPERADMIN (sin empresa activa).
- **docRole en M1**, con esta precedencia: AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD (JCA/JCD que no participan) → OPERARIO. La matriz está en `DocumentPermissionResolver.cs` (backend) y en `permissions.ts` (frontend), idéntica en los dos.

## 5. Decisiones clave de M1 Documentos (todas en el PRD v1.1)

| Tema | Decisión |
|---|---|
| Revisor / aprobador | Revisor ∈ {JCA, JCD, AUD, DIR}; aprobador ∈ {JCD, DIR}. El **autor queda excluido**. Revisor ≠ aprobador. Se validan en el servidor con el endpoint `candidatos-asignacion`. |
| Enviar a revisión | Exige revisor **y** aprobador asignados. |
| Firma | PIN de **4 dígitos** (Mi Perfil). Error `PIN_NO_CONFIGURADO`. El SUPERADMIN puede resetearlo. |
| PDF de distribución | Se genera **al firmar** con LibreOffice. Lleva un sello por página y el SHA-256 queda en `FIRMA_REGISTRADA`. Sin original no se puede firmar. Si la conversión falla: 422 `PDF_CONVERSION_FAILED` y no se publica nada. |
| Original en PDF | Solo para **INF, MAT y PLAN** (para los demás, .docx o .xlsx). Se valida la extensión y la firma real del archivo. |
| Rechazo | Acciones propias `RECHAZADO_EN_REVISION` / `RECHAZADO_EN_APROBACION`, con motivo de 20 a 500 caracteres. Se muestra un aviso en el detalle. `REVISION_CANCELADA` es una acción aparte. |
| Nueva versión | El **autor es quien la crea**. La crean el autor de origen, JCA o JCD. El revisor y el aprobador se heredan solo si siguen siendo válidos. |
| Revisión periódica | Se gestiona por **rol global JCA/JCD**: iniciar, confirmar y cancelar. Al confirmar, la fecha se sugiere según el tipo y es editable, con mínimo **hoy + 30 días** (Lima). El inicio es **manual**. Al vencer: `REVISION_PERIODICA_VENCIDA` (actor Sistema), notificación y aviso rojo, sin cambio de estado. Idempotencia por ciclo. |
| Visor | pdf.js con vista previa en el servidor. **Sin descarga.** Impresión solo **JCD y DIR**. Sin copiar texto. El aprobador ve el documento en EN_APROBACION. Cada apertura registra `VISUALIZACION`. |
| Autor | **Lee** su documento en PUBLICADO y OBSOLETO (diverge a propósito del PRD v1.0). |
| Protección documental | La **única descarga** es la **copia no controlada**: leyenda "COPIA NO CONTROLADA", nombre del usuario y hora de Lima, registro `DESCARGA`. Solo en PUBLICADO y EN_REVISION_PERIODICA; OBSOLETO no se descarga. **Almacenamiento privado** fuera de `wwwroot`. Se retiró el circuito de URLs firmadas. |
| Copias controladas | Solo el **JCD** las emite: número `{código}-v{ver}-C{nnn}`, destinatario, estado VIGENTE/RECOGIDA/ANULADA. Al quedar obsoleta la versión, avisa qué copias hay que recoger. La impresión desde el visor registra `IMPRESION`. |
| Notificaciones | Destinatarios por transición. Nunca al actor. Envío best-effort. **Pendientes = solo lo asignado al usuario** (EN_REVISION_PERIODICA → JCA/JCD). |
| Restaurar | Solo **JCA y DIR**. |
| Detalle del documento | **Dos columnas**: pestañas (Resumen, Historial, Versiones, Vínculos, Copias, Log), barra lateral fija (acciones, ficha con versión **y** fecha de publicación, responsables con foto o iniciales, actividad reciente) y encabezado fijo. El Log se refresca al instante. La pestaña Resumen muestra la tarjeta "Documento publicado". |

## 6. Sesión por inactividad (19-oct-2026), **implementado y funcionando según Toño**

- **Configuración por empresa:**
  - el ADMINISTRADOR_EMPRESA la define en **Usuarios → Seguridad de sesión**;
  - el SUPERADMIN define el valor global y los límites en **menú → Parámetros de sesión** (`/admin/parametros-sesion`), y puede editar cada empresa desde Administración de Empresas.
- **Valores por defecto:** inactividad 30 min (rango 5–240), con aviso 60 s antes y botón "Seguir conectado"; **sesión máxima 12 h** (rango propuesto 1–24).
- **Servidor:** `RefreshToken` guarda `SesionIniciadaEn` y `UltimaActividadEn`. `/refresh` devuelve 401 `SESION_INACTIVA` o `SESION_MAXIMA_ALCANZADA`. El endpoint `POST /api/auth/actividad` registra la actividad real; el polling y SignalR no cuentan. Migración `20261020041143_AddPoliticaSesion`.

## 7. Último tema en curso: PIN olvidado

Ya existen dos vías, sin necesidad de cambiar código:

1. **El usuario mismo:** Mi Perfil → PIN de firma. Solo pide la **contraseña actual**, no el PIN anterior.
2. **El SUPERADMIN:** Administración de Empresas → empresa → Asignar usuarios → acción "Resetear PIN".

Le **ofrecí a Toño dos mejoras**, todavía **sin respuesta**:

- (a) una pista "¿Olvidaste tu PIN? Cámbialo aquí con tu contraseña" en el modal de firma y en Mi Perfil;
- (b) que el ADMINISTRADOR_EMPRESA también pueda resetear el PIN de su empresa (tema abierto P-01).

## 8. Estado de los entregables

- **PRD v1.1 consolidado** (`SHAC_PRD_v1.1.docx` + `claude/SHAC_PRD_v1.1.md`):
  - M1 absorbe ADD-01 y ADD-02 y todas las decisiones de M1;
  - reglas RN-DOC-001 a 037, matriz y audit trail completos;
  - el anexo A traza cada cambio;
  - M2 a M5 sin cambios;
  - ADD-03 (multi-local) y ADD-04 (edición del QE) siguen vigentes.
- **Desactualizados, por regenerar:**
  - `SHAC-M1-Matriz-Responsabilidades-v1.0.docx` (RACI): ofrecido a Toño, sin respuesta.
  - `claude/SHAC-Mapa-Proceso-Control-Documentario.md`: falta agregar quién recibe aviso en cada paso, nueva versión, revisión periódica, visor, protección y copias.
  - El PRD aún **no** incluye la política de sesión: agregarla en M6 o en las reglas globales cuando se verifique.
- **Changes posteriores al 07-oct:** Toño los fue confirmando como OK en la prueba manual, pero **no hay una verificación formal escrita** (`SHAC-Verificacion-*.md`). Confirmar con Toño si se implementaron y archivaron:
  - `copias-controladas`
  - `original-pdf-tipos-permitidos`
  - `resumen-info-publicacion`
  - `detalle-documento-dos-columnas`
  - `sesion-timeout-inactividad`

## 9. Temas abiertos (PRD v1.1 §4.19; decide Toño)

| # | Tema | Recomendación |
|---|---|---|
| P-01 | Que el ADMIN_EMPRESA resetee el PIN | Decidir junto con M6 |
| P-02 | Notificar siempre al autor cuando hay un rechazo (hoy depende del flag `NotificarAutor`) | Sí, siempre |
| P-03 | Exigir el original para **enviar a revisión** (hoy solo se exige para firmar) | Sí |
| P-04 | Que un OPERARIO vea en el Log quién descargó | Restringir a JCA/JCD/AUD/DIR |
| P-05 | Ratificar el retiro de las URLs firmadas como cumplimiento de RN-DOC-009 | Ratificar |
| P-06 | Quién vincula documentos con QE/NC, y si se vincula desde el alta de NC | `canEdit`; no desde el alta |
| P-07 | Eliminar en EN_REVISION (el servidor lo acepta sin validar el permiso; la interfaz solo permite en BORRADOR) | Limitar a BORRADOR y validar en el servidor |
| P-08 | Canal email para las alertas | Junto con el hosting |
| P-09 | Que DIR también emita copias controladas | Mantener solo JCD |
| P-11 | Que JCD también restaure | Mantener JCA/DIR |
| **P-12** | **Posibles bugs por verificar en el código:** (a) que la versión de origen en EN_REVISION_PERIODICA pase a OBSOLETO al publicar la nueva (el handler solo obsoleta PUBLICADO); (b) el aviso informativo al autor en EN_REVISION → EN_APROBACION; (c) que el servidor exija el motivo en el rechazo en aprobación | Cowork verifica y emite un change de corrección |
| P-13 | Que una falla del sellado bloquee la publicación (hoy publica sin sello) | Bloquear |
| P-14 | Leyenda "COPIA NO CONTROLADA" en lo impreso desde el visor | Sí |
| **P-15** | **¿MAT = "Matriz" (PRD v1.0) o "Material" (interfaz y Toño)?** | Pendiente de respuesta de Toño |
| P-10 | Hosting y dominio de producción | **Diferido por Toño** |

**Otros pendientes heredados:** los imports de `mocks/` que quedan en otros módulos, y el handler MSW viejo `POST /:id/publicar` con `body.password`, que no se usa.

## 10. Próximo paso sugerido al retomar

1. Preguntar a Toño si quiere las mejoras del PIN (sección 7, a y b).
2. Pedirle la respuesta de P-15 (MAT).
3. Proponer verificar P-12 en el código, que son posibles bugs reales de M1.
4. Ofrecer regenerar la RACI M1 v1.1 y el mapa de proceso, y agregar la política de sesión al PRD.
5. Siguiente etapa: verificación de otro módulo, cuando Toño lo indique.
