# INSTRUCCIONES PARA CLAUDE CODE — QE reabierto: reiniciar el cierre, la verificación y la firma de la causa raíz en el nuevo ciclo

- **Fecha:** 2026-11-19
- **Autor:** Cowork (para Toño)
- **Origen:** en el **QE-2026-006**, en PENDIENTE_CIERRE, el supervisor del área (luis.peralta, SUPERVISOR de Logística y Operaciones) ve en el indicador "Siguiente paso: Firma de cierre del supervisor del área · **Te toca a ti**", pero **no aparece ningún botón para firmar**. La sección de cierre solo muestra las firmas "ya confirmadas" de usuarios anteriores.
- **Change OpenSpec:** `qe-reapertura-reinicia-cierre`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Lleva migración solo de datos** (§3.3). No cambia el esquema.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 La reapertura no reinicia el cierre del ciclo anterior

- `Features/QualityEvents/Shared/QEReaperturaHelper.ReabrirAsync` solo hace:
  - `Estado = EN_INVESTIGACION`;
  - `Ciclo += 1`;
  - registrar el audit `REABIERTO`;
  - sincronizar el incidente.
- **No limpia nada del ciclo anterior.** Siguen con sus valores:
  - `ResultadoCierre`;
  - `CerradoPorId` (firma 1, JCA);
  - `CierreFirmaSupervisorId` (firma 2, supervisor);
  - `FechaVerificacionProgramada`;
  - `ResultadoVerificacion`;
  - `CausaRaizAprobadaPorId` y `CausaRaizFirmadaEn`.
- `ReabrirAsync` lo llaman `VerificacionEficaciaQEHandler.cs:67` (resultado NO_EFECTIVO) y `ForzarVencimientoVerificacionHandler.cs:25`.

### 1.2 Efecto en el ciclo 2 al volver a PENDIENTE_CIERRE

- **Sección de cierre** (`QECierreSection.tsx:275–289`):
  - `showClosureForm` exige `!qe.resultadoCierre`, que es falso;
  - `showFirstSignature` exige `!qe.cerradoPorId`, que es falso;
  - `showPendingSecondSignature` exige `!qe.cierreFirmaSupervisorId`, que es falso.
  
  Así que **no aparece ningún botón**, y las filas muestran las firmas del ciclo 1 como "confirmadas".
- **Backend:** `FirmarCierreQEHandler` respondería "el cierre ya tiene ambas firmas registradas".
- **`QESiguientePasoResolver`** (líneas 93–104): en PENDIENTE_CIERRE solo mira `ResultadoCierre` y `CerradoPorId`, **no** `CierreFirmaSupervisorId`. Por eso devuelve `FIRMA_SUPERVISOR` con "te toca", aunque esa firma ya exista.
- **Riesgo adicional:** la firma de la causa raíz del ciclo 1 también se arrastra. En el ciclo 2, RN-QE-002 permitiría pasar a EN_EJECUCION sin un análisis nuevo aprobado.

---

## 2. Decisiones de Toño

- **D1:** al reabrir (ciclo N+1) se **reinicia**:
  - **el cierre:** `ResultadoCierre`, `CerradoPorId` y `CierreFirmaSupervisorId`;
  - **la verificación:** `FechaVerificacionProgramada` y `ResultadoVerificacion`. También `PlazoVerificacionDias`, si existe y se fija al cerrar;
  - **la firma de la causa raíz:** `CausaRaizAprobadaPorId` y `CausaRaizFirmadaEn`.
  
  El **texto** del análisis (método, 5 Porqués o Ishikawa, `CausaRaizDefinitiva`) **se conserva** como punto de partida editable. Las **AC del ciclo anterior** siguen como están, cerradas, como historial. Todo queda trazado en el audit trail (RN-QE-007).
- **D2:** **migración de datos** para destrabar QE-2026-006 y cualquier otro QE en la misma situación.

---

## 3. Qué implementar

### 3.1 Backend: reapertura (`Shared/QEReaperturaHelper.cs`)

- **Antes** de cambiar el estado, registrar en el audit trail una entrada `CICLO_REINICIADO`:
  - `CampoModificado = "cierre/verificacion/causaRaiz"`;
  - `ValorAnterior` = un resumen **legible** del ciclo que termina, con nombres y fechas y nunca ids. Por ejemplo: "Ciclo 1 · Cierre: {resultado (100 caracteres)} · Firma JCA: {nombre} {fecha} · Firma supervisor: {nombre} {fecha} · Verificación: {resultado} {fecha} · Causa raíz aprobada por {nombre} {fecha}";
  - `ValorNuevo = "Ciclo {N+1}"`;
  - el actor es el mismo de la reapertura.
- **Después**, poner en `null` los campos de D1.
- Mantener lo actual: `Estado = EN_INVESTIGACION`, `Ciclo += 1`, el audit `REABIERTO` y la sincronización del incidente.
- **No tocar** `ResponsableInvestigacionId`. El mismo responsable sigue, y el JCA puede cambiarlo.
- **No tocar** las AC del ciclo anterior.
- **AC por ciclo:** verificar si la regla "todas las AC cerradas con evidencia → PENDIENTE_CIERRE" contaría las AC del ciclo anterior (ya cerradas) y saltaría directo a PENDIENTE_CIERRE en el ciclo 2 sin AC nuevas.
  - Si pasa, la regla correcta es: el paso automático a PENDIENTE_CIERRE en el ciclo N exige **al menos una AC creada después de la última reapertura**, y que todas las AC abiertas estén cerradas.
  - Implementarla en el lugar donde hoy se evalúa (el endpoint de verificar AC de `ac-ejecucion-verificacion-evidencias`). Para saber qué AC son del ciclo actual, comparar `AccionCorrectivaQE.CreadoEn` con la fecha del último `REABIERTO`, sin agregar columnas.
  - Anotar en `design.md` lo que se encuentre.

### 3.2 Backend: indicador "Siguiente paso" (`Shared/QESiguientePasoResolver.cs`)

- En PENDIENTE_CIERRE, agregar el caso de que **las dos firmas** existan. No debería pasar con la corrección, pero sirve de defensa ante datos inconsistentes: devolver un paso `CIERRE_INCONSISTENTE`, con responsables = JCA y sin plazo, que en el frontend se muestra como "Datos de cierre inconsistentes — contacta al Jefe de Calidad". **Nunca** `FIRMA_SUPERVISOR`.
- Revisar en general que **cada paso del resolver tenga su botón en la UI con la misma condición**:
  - `REGISTRAR_RESULTADO_CIERRE` ↔ `showClosureForm`;
  - `FIRMA_JCA` ↔ `showFirstSignature`;
  - `FIRMA_SUPERVISOR` ↔ `showSecondSignature`.
  
  Agregar un test que compare los dos para los mismos fixtures, como se indica en §4.

### 3.3 Migración de datos (`dotnet ef migrations add FixReaperturaCicloCierre`)

**Objetivo:** en los QE **con `ciclo > 1`**, limpiar los campos de D1 que **vienen del ciclo anterior**, sin borrar los que ya se completaron legítimamente en el ciclo actual.

**Criterio por campo:** el campo se limpia **solo si su última entrada de audit es anterior** al último `REABIERTO` del QE.

| Campo(s) | Entrada de audit que lo respalda |
|---|---|
| `resultado_cierre` | `CIERRE_INICIADO` |
| `cerrado_por_id` | `FIRMA_CIERRE_JEFE_CALIDAD` (o `FIRMA_REGISTRADA` con `campo_modificado = 'cerradoPorId'`, datos viejos) |
| `cierre_firma_supervisor_id` | `FIRMA_CIERRE_SUPERVISOR` (o `FIRMA_REGISTRADA` con `campo_modificado = 'cierreFirmaSupervisorId'`) |
| `causa_raiz_aprobada_por_id`, `causa_raiz_firmada_en` | `CAUSA_RAIZ_APROBADA` |
| `fecha_verificacion_programada` | La firma del supervisor (se fija al cerrar) |
| `resultado_verificacion` | La entrada de verificación de eficacia |

Si no hay ninguna entrada que respalde el valor en el ciclo actual, se limpia.

- **Alcance:** solo QE con `deleted_at IS NULL` y estado **EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION o PENDIENTE_CIERRE**. Un QE CERRADO, EN_VERIFICACION o VERIFICADO en el ciclo N ya tiene datos válidos de ese ciclo.
- **Audit:** por cada QE corregido, insertar una entrada `CORRECCION_DATOS_REAPERTURA` con `realizado_por_id = 'system'`, `realizado_por_nombre = 'Sistema'` y `generado_por_ia = true` (el patrón de las acciones de sistema), y en `valor_anterior` un resumen de lo que se limpió.
- Escribirlo en SQL dentro de `Up()`, con CTE y `UPDATE … FROM`. Usar los nombres reales de las columnas: confirmarlos en `ShacDbContextModelSnapshot.cs`.
- `Down()` puede quedar vacío, con un comentario.
- **Antes** de dar por buena la migración, listar en `design.md` los QE afectados (número, ciclo y campos limpiados), corriéndola contra la base de desarrollo. **QE-2026-006 debe aparecer.**

### 3.4 Frontend (`shc-controldoc/src/features/quality-events/`)

- **`QECierreSection.tsx`:** no hacen falta cambios de lógica. Con los datos limpios, las condiciones vuelven a funcionar. Revisar que las filas de firma tomen la fecha y el nombre del **ciclo actual** (la última entrada del audit **posterior** al último `REABIERTO`) y no una entrada vieja.
- **Banner "Siguiente paso":** agregar el texto del paso `CIERRE_INCONSISTENTE`.
- **Cabecera:** si `ciclo > 1`, mostrar el badge "Ciclo {n}", si todavía no se muestra (RN-QE-007).
- **Audit trail:** agregar las etiquetas `CICLO_REINICIADO` ("Ciclo reiniciado") y `CORRECCION_DATOS_REAPERTURA` ("Corrección de datos de reapertura").

**i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.siguientePaso.paso.CIERRE_INCONSISTENTE` | Datos de cierre inconsistentes — contacta al Jefe de Calidad | Inconsistent closure data — contact the Quality Manager |
| `detail.header.ciclo` | Ciclo {{n}} | Cycle {{n}} |

### 3.5 MSW

- La reapertura en los handlers limpia los mismos campos.
- Incluir un fixture con un QE en ciclo 2 y PENDIENTE_CIERRE **sin** firmas, que espera la firma del JCA.

---

## 4. Tests

**Backend**
- **Reapertura:** con un QE CERRADO y verificación NO_EFECTIVO:
  - queda en EN_INVESTIGACION, con `Ciclo = 2`;
  - los campos de D1 quedan en `null`;
  - `CausaRaizDefinitiva` y el análisis **se conservan**;
  - las AC del ciclo 1 siguen CERRADAS;
  - hay una entrada `CICLO_REINICIADO` con el resumen y los nombres.
- **Ciclo 2 completo:**
  1. sin aprobar de nuevo la causa raíz, la transición a EN_EJECUCION → 422 (RN-QE-002);
  2. se aprueba, se ejecuta y se verifica una AC nueva;
  3. el QE pasa a PENDIENTE_CIERRE;
  4. se registra el resultado, firma el JCA y firma el supervisor del área → CERRADO.
- **AC del ciclo anterior:** un QE reabierto que **no** tiene AC nuevas no pasa solo a PENDIENTE_CIERRE.
- **Resolver:** con las dos firmas presentes en PENDIENTE_CIERRE → `CIERRE_INCONSISTENTE`, nunca `FIRMA_SUPERVISOR`.
- **Migración**, sobre una base de test con estos casos:
  - un QE en ciclo 2, PENDIENTE_CIERRE, con las firmas anteriores al `REABIERTO` → quedan limpias, con el audit `CORRECCION_DATOS_REAPERTURA`;
  - un QE en ciclo 2 con la firma del JCA **posterior** al `REABIERTO` → esa firma **se conserva**;
  - un QE en ciclo 1 → no se toca;
  - un QE en ciclo 2 en estado CERRADO → no se toca.

**Frontend**
- **Coherencia entre el indicador y los botones:** para un set de fixtures en PENDIENTE_CIERRE (sin resultado, con resultado sin firmas, con firma del JCA), cuando el banner dice "Te toca a ti" para un usuario, la sección de cierre le muestra el botón correspondiente, y viceversa.
- Con `ciclo = 2` se muestra el badge "Ciclo 2".

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet ef database update`** (hay migración de datos) **→ `dotnet build`** → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado:**
  1. Abrir QE-2026-006: la cabecera muestra "Ciclo 2" y el audit trail muestra `CORRECCION_DATOS_REAPERTURA`. El "Siguiente paso" ya **no** dice "Firma del supervisor": muestra el paso real que corresponde al ciclo 2, probablemente "Registrar el resultado del cierre" (JCA).
  2. Como JCA: registrar el resultado y firmar. Como luis.peralta (SUPERVISOR del área): el banner dice "Te toca a ti" **y aparece el botón "Firmar cierre"**. Firmar con PIN: el QE queda CERRADO.
  3. Con otro QE: verificar la eficacia como "No efectiva". El QE pasa al ciclo siguiente con el cierre y la firma de la causa raíz en blanco, y el texto del análisis se conserva.
- Toño avisa con **"listo"** para que Cowork verifique.
