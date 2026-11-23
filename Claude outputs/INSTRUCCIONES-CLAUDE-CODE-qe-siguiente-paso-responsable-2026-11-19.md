# INSTRUCCIONES PARA CLAUDE CODE — QE: indicador "Siguiente paso" con responsable, antigüedad en el estado y plazo

- **Fecha:** 2026-11-19
- **Autor:** Cowork (para Toño)
- **Origen:** Toño tiene el QE-2026-006 en PENDIENTE_CIERRE y, al abrirlo, no puede ver quién es el responsable del cierre ni del estado actual. Necesita saberlo para hacer el seguimiento.
- **Change OpenSpec:** `qe-siguiente-paso-responsable`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Sin migración**: todo es lectura y cálculo.

---

## 1. Diagnóstico confirmado leyendo el código

- **`components/QECierreSection.tsx`:**
  - el bloque de firmas ("Firma 1 — Jefe de Calidad" / "Firma 2 — Supervisor de {área} · pueden firmar: …") **solo se muestra** con `showFirmas = (PENDIENTE_CIERRE && !!qe.resultadoCierre) || showSummary` (línea 292);
  - con PENDIENTE_CIERRE y **sin** `resultadoCierre` (el primer paso del cierre), solo el JCA ve el formulario (`showClosureForm`, línea 275). **Cualquier otro usuario no ve nada**: ni qué falta, ni quién debe hacerlo.
- **`components/QEHeaderSection.tsx`:** la cabecera muestra al responsable de investigación (líneas 159–175), pero **no hay ningún indicador** del paso pendiente en los demás estados, ni desde cuándo el QE está en ese estado, ni de su plazo.
- **Datos que ya están disponibles:**
  - `ObtenerQualityEventHandler` devuelve `responsableInvestigacionNombre`, `cerradoPorNombre`, `cierreFirmaSupervisorNombre`, `supervisoresArea` (en PENDIENTE_CIERRE), `accionesCorrectivas` (con responsable y estado), `fechaVerificacionProgramada` y `auditTrail`;
  - `AjustePlazoCalculator.ContarDiasHabiles` sirve para contar días hábiles. No existe una tabla de feriados, así que solo se excluyen sábados y domingos.
- **PRD §1.3**, plazo máximo por estado:

  | Estado | Plazo del PRD |
  |---|---|
  | ABIERTO | 48 h para ser asignado a investigación |
  | EN_INVESTIGACION | Según la severidad: Baja 15 d · Media 10 d · Alta 7 d · Crítica 3 d (días hábiles, RNG-003) |
  | ANALISIS_COMPLETADO | 2 días hábiles para la aprobación del JCA |
  | EN_EJECUCION | Según el plazo de cada AC |
  | PENDIENTE_CIERRE | 5 días hábiles para el cierre. La firma del supervisor tiene 3 días hábiles desde la firma del JCA (P4) |
  | CERRADO | Hasta la `fechaVerificacionProgramada` |
  | EN_VERIFICACION | 10 días hábiles para completar la verificación |

---

## 2. Decisiones de Toño

- **D1:** en la cabecera de **todos** los QE se agrega un indicador **"Siguiente paso"**, visible para **todos** los usuarios. Indica:
  - qué hay que hacer;
  - **quién** debe hacerlo, con nombres;
  - **desde cuándo** el QE está en ese estado.

  Además, el bloque de firmas de cierre se muestra **siempre** en PENDIENTE_CIERRE, con "Paso 1: registrar el resultado (JCA)".
- **D2:** el **plazo de cada estado** según el PRD §1.3 se muestra **solo como información**, con semáforo. No genera avisos automáticos.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/Features/QualityEvents/`)

**a) Cálculo del siguiente paso** (`Shared/QESiguientePasoResolver.cs`, función pura más lecturas mínimas)

- Recibe el QE ya cargado (con AC, nombres, supervisores del área y audit trail) y devuelve:

  ```csharp
  public sealed record QESiguientePaso(
      string Paso,                    // código: ver la tabla
      IReadOnlyList<ResponsablePaso> Responsables, // { Id, NombreCompleto, Rol, AvatarUrl? }
      DateTime EstadoDesde,           // UTC
      DateTime? PlazoFecha,           // UTC; null si no aplica
      string? PlazoRegla,             // texto corto de la regla del PRD, p. ej. "PRD §1.3 · 5 días hábiles"
      int? Progreso, int? Total);     // solo EN_EJECUCION: AC cerradas / total
  ```

- **Tabla de pasos.** "JCA" significa los JEFE_CALIDAD_SYST activos de la empresa; reutilizar el helper de roles de las notificaciones, que ya filtra las asignaciones ACTIVAS.

  | Estado (y condición) | `Paso` | Responsables | Plazo |
  |---|---|---|---|
  | ABIERTO, sin responsable | `ASIGNAR_RESPONSABLE` | JCA | `EstadoDesde + 48 h` |
  | ABIERTO, con responsable | `INICIAR_INVESTIGACION` | Responsable de investigación (y JCA) | `EstadoDesde + 48 h` |
  | EN_INVESTIGACION | `COMPLETAR_ANALISIS` | Responsable de investigación | `EstadoDesde` + N días hábiles según la severidad (15/10/7/3) |
  | EN_INVESTIGACION o ANALISIS_COMPLETADO, con causa raíz de 100 caracteres o más y sin firmar | `APROBAR_CAUSA_RAIZ` | JCA | En ANALISIS_COMPLETADO, `EstadoDesde + 2 días hábiles`; en EN_INVESTIGACION, el mismo plazo de esa fila |
  | ANALISIS_COMPLETADO, con causa raíz firmada | `INICIAR_EJECUCION` | JCA | `EstadoDesde + 2 días hábiles` |
  | EN_EJECUCION | `EJECUTAR_ACS` | Responsables **distintos** de las AC que no están CERRADA. Si hay alguna en COMPLETADA, se agrega el JCA (verificación) | El **mayor** `PlazoFecha` de las AC abiertas |
  | PENDIENTE_CIERRE, sin `resultadoCierre` | `REGISTRAR_RESULTADO_CIERRE` | JCA | `EstadoDesde + 5 días hábiles` |
  | PENDIENTE_CIERRE, con resultado y sin firma del JCA | `FIRMA_JCA` | JCA | `EstadoDesde + 5 días hábiles` |
  | PENDIENTE_CIERRE, con firma del JCA y sin la del supervisor | `FIRMA_SUPERVISOR` | `SupervisoresArea` | Fecha de la firma del JCA (del audit trail `FIRMA_CIERRE_JEFE_CALIDAD`) + 3 días hábiles |
  | CERRADO | `ESPERA_VERIFICACION` | JCA | `FechaVerificacionProgramada` |
  | EN_VERIFICACION | `VERIFICAR_EFICACIA` | JCA. Si existe un auditor asignado en el modelo real, usarlo y anotarlo en `design.md` | `EstadoDesde + 10 días hábiles` |
  | VERIFICADO | `FINALIZADO` | — | — |

- **`EstadoDesde`:** la entrada **más reciente** del audit trail del QE con `EstadoNuevo == qe.Estado`. Si no existe (un QE en ABIERTO desde su creación), se usa `CreadoEn`. Contemplar también las entradas automáticas, como la reapertura o el paso a PENDIENTE_CIERRE generado por la AC.
- **Días hábiles:** crear `DiasHabiles.Sumar(DateTime desde, int dias)`, que sume días saltando sábados y domingos y cuente en hora de Lima. Va junto a `AjustePlazoCalculator` o en un helper compartido. Sin feriados por ahora: anotarlo en `design.md` como limitación hasta que exista la tabla de feriados (RNG-003).
- **Responsables:** siempre con **nombres**, nunca ids. Excluir a los inactivos. Si la lista sale vacía (por ejemplo, un área sin supervisor), devolverla vacía; el frontend lo muestra como "Sin responsable disponible".

**b) Lectura:** `ObtenerQualityEventHandler` agrega `siguientePaso` a la respuesta del detalle. **No** se agrega al listado.

### 3.2 Frontend (`shc-controldoc/src/features/quality-events/`)

**a) Nuevo `components/QESiguientePasoBanner.tsx`**, en la parte superior de `QEHeaderSection` (o justo debajo del encabezado del detalle):

- **Línea 1:** "**Siguiente paso:** {texto del paso}", con un ícono según el paso.
- **Línea 2:** "**Responsable:** {avatar o iniciales + nombre}…". Si hay más de 3, mostrar 3 y "+N". Si la lista está vacía: "Sin responsable disponible", en ámbar.
- **Línea 3**, en texto chico:
  - "En este estado desde {dd/mm/aaaa} (hace {N} días)";
  - si hay plazo, " · Plazo: vence el {dd/mm/aaaa}", con semáforo (verde, ámbar a 1 día hábil o menos, rojo si venció) y un tooltip con `plazoRegla`.
- **EN_EJECUCION:** agregar "({progreso} de {total} AC cerradas)".
- **FINALIZADO:** un banner neutro, "Proceso finalizado — verificado el {fecha}".
- **Si el usuario actual es uno de los responsables,** el banner se resalta con un borde coral y el texto "Te toca a ti".
- El banner es **solo informativo**: los botones de acción siguen en sus secciones.

**b) `components/QECierreSection.tsx`**

- En PENDIENTE_CIERRE, el bloque de pasos se muestra **siempre**, para todos, con tres filas:
  1. **"Paso 1 — Registrar el resultado del cierre (Jefe de Calidad)":** "Pendiente", o "✓ {fecha}". Al JCA el formulario se le sigue mostrando como ahora.
  2. **"Firma 1 — Jefe de Calidad":** igual que hoy.
  3. **"Firma 2 — Supervisor de {área}":** igual que hoy, con "pueden firmar: …".
- `showFirmas` pasa a ser `estado === 'PENDIENTE_CIERRE' || showSummary`. Las filas se muestran como pendientes según los datos.
- Mantener la regla de hooks: los hooks van antes de cualquier `return`.

**c) Tipos:** agregar `siguientePaso` al tipo `QualityEvent` (detalle).

**d) i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.siguientePaso.titulo` | Siguiente paso | Next step |
| `detail.siguientePaso.responsable` | Responsable | Owner |
| `detail.siguientePaso.sinResponsable` | Sin responsable disponible | No owner available |
| `detail.siguientePaso.teToca` | Te toca a ti | Your turn |
| `detail.siguientePaso.desde` | En este estado desde el {{fecha}} (hace {{dias}} días) | In this status since {{fecha}} ({{dias}} days ago) |
| `detail.siguientePaso.plazo` | Plazo: vence el {{fecha}} | Due: {{fecha}} |
| `detail.siguientePaso.progresoAC` | {{progreso}} de {{total}} AC cerradas | {{progreso}} of {{total}} CAs closed |
| `detail.siguientePaso.finalizado` | Proceso finalizado — verificado el {{fecha}} | Process complete — verified on {{fecha}} |
| `detail.siguientePaso.paso.ASIGNAR_RESPONSABLE` | Asignar responsable de investigación | Assign investigation lead |
| `detail.siguientePaso.paso.INICIAR_INVESTIGACION` | Iniciar la investigación | Start the investigation |
| `detail.siguientePaso.paso.COMPLETAR_ANALISIS` | Completar el análisis de causa raíz | Complete the root cause analysis |
| `detail.siguientePaso.paso.APROBAR_CAUSA_RAIZ` | Aprobar la causa raíz (firma con PIN) | Approve the root cause (PIN signature) |
| `detail.siguientePaso.paso.INICIAR_EJECUCION` | Pasar a ejecución de acciones correctivas | Move to corrective action execution |
| `detail.siguientePaso.paso.EJECUTAR_ACS` | Ejecutar y verificar las acciones correctivas | Execute and verify the corrective actions |
| `detail.siguientePaso.paso.REGISTRAR_RESULTADO_CIERRE` | Registrar el resultado del cierre | Record the closure result |
| `detail.siguientePaso.paso.FIRMA_JCA` | Firma de cierre del Jefe de Calidad | Quality Manager closure signature |
| `detail.siguientePaso.paso.FIRMA_SUPERVISOR` | Firma de cierre del supervisor del área | Area supervisor closure signature |
| `detail.siguientePaso.paso.ESPERA_VERIFICACION` | Esperar la fecha de verificación de eficacia | Wait for the effectiveness check date |
| `detail.siguientePaso.paso.VERIFICAR_EFICACIA` | Verificar la eficacia | Verify effectiveness |
| `detail.cierre.paso1` | Paso 1 — Registrar el resultado del cierre (Jefe de Calidad) | Step 1 — Record the closure result (Quality Manager) |

### 3.3 MSW

- El detalle del QE devuelve un `siguientePaso` coherente con el estado del fixture. Basta con una versión simplificada del resolver.
- Los fixtures incluyen un QE en PENDIENTE_CIERRE sin resultado y otro esperando la firma del supervisor.

---

## 4. Tests

**Backend (`QESiguientePasoResolver`)**
- Cada fila de la tabla de §3.1a, con su paso, sus responsables (nombres) y su plazo esperado:
  - EN_INVESTIGACION con severidad CRITICA: plazo de 3 días hábiles, saltando el fin de semana;
  - EN_EJECUCION con 3 AC (1 CERRADA, 1 COMPLETADA, 1 EN_EJECUCION): responsables = el de la AC abierta + el JCA, progreso 1/3, plazo = el mayor de las abiertas;
  - PENDIENTE_CIERRE sin resultado → `REGISTRAR_RESULTADO_CIERRE` (JCA); con firma del JCA → `FIRMA_SUPERVISOR` con `SupervisoresArea` y plazo = fecha de esa firma + 3 días hábiles;
  - un área sin supervisor → lista vacía.
- `EstadoDesde`: toma la última entrada del audit trail con ese estado. Un QE recién creado usa `CreadoEn`.
- Los usuarios inactivos no aparecen como responsables.

**Frontend**
- El banner muestra el paso, los responsables, "desde" y el plazo con su semáforo. Con el usuario actual entre los responsables, aparece "Te toca a ti".
- Más de 3 responsables → "+N".
- En PENDIENTE_CIERRE sin resultado, **un SUPERVISOR** ve los tres pasos con "Paso 1 — Pendiente" (antes no veía nada).
- VERIFICADO → banner de proceso finalizado.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado:**
  1. Abrir **QE-2026-006** (PENDIENTE_CIERRE) como un usuario que **no** es JCA. La cabecera muestra "Siguiente paso: Registrar el resultado del cierre · Responsable: {JCA} · En este estado desde … · Plazo: vence el …", y la sección de cierre muestra los tres pasos.
  2. Como JCA, en el mismo QE, aparece "Te toca a ti". Registrar el resultado y firmar: el banner pasa a "Firma de cierre del supervisor del área" con los nombres de los supervisores y su plazo.
  3. Recorrer QE en otros estados (ABIERTO, EN_INVESTIGACION, EN_EJECUCION, CERRADO, VERIFICADO): cada uno muestra el paso y el responsable correctos.
  4. Un QE con el plazo vencido muestra el semáforo en rojo.
- Toño avisa con **"listo"** para que Cowork verifique.
