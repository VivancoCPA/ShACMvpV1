# INSTRUCCIONES PARA CLAUDE CODE — Dashboard: tarjetas "Requiere atención" coherentes con sus listas y siempre actualizadas

- **Fecha:** 2026-11-07
- **Autor:** Cowork (para Toño)
- **Origen:** Toño reportó que las tarjetas de "Requiere atención" no se actualizan o no calculan bien. Por ejemplo, para el Jefe de Calidad, "Esperan mi firma o aprobación" muestra 4, pero ese número no coincide con la lista de más abajo.
- **Change OpenSpec:** `dashboard-alertas-coherentes`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** va sobre `dashboard-layout-4-zonas` (ya implementado).
- **Sin migración.**

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 La tarjeta y la lista no cuentan lo mismo

- `features/dashboard/pages/JefeCalidadDashboard.tsx:31`: `esperanFirma` cuenta los ítems de `useAccionesRequeridas()` con tipo `QE_APROBAR_CAUSA_RAIZ` o `QE_CERRAR`.
- La lista que está debajo (`AccionesRequeridasWidget`) muestra **todos** los pendientes del usuario (asignar responsable, iniciar investigación, verificar, AC, documentos), cortados en 10 (`VISIBLE_LIMIT`).
- La tarjeta enlaza a `to="#acciones-requeridas"`: un ancla que solo hace scroll y **no filtra**.
- `QE_CERRAR` (`utils/accionesRequeridas.utils.ts:68–72`) agrupa dos situaciones distintas:
  - el QE está en PENDIENTE_CIERRE **sin** resultado de cierre (hay que registrar el resultado);
  - el QE tiene el resultado registrado y falta la firma del JCA.

### 1.2 "AC vencidas" enlaza a otro conjunto

- `JefeCalidadDashboard.tsx:39`: el valor de la tarjeta es el **KPI-08**, que cuenta las AC vencidas de la empresa en QE, NC e incidentes. Lo calcula `CalcularKpi08` en `DashboardKpiCalculator.cs` y se marca como `TIEMPO_REAL`.
- `JefeCalidadDashboard.tsx:43`: la tarjeta lleva a `#acs-por-vencer`, que es la lista de **AC por vencer** en los próximos 5 días. Es otro conjunto, así que el número nunca coincide.

### 1.3 Las tarjetas que salen del summary no se refrescan

- `hooks/useDashboardSummary.ts` usa la queryKey `DASHBOARD_QUERY_KEYS.summary()`, y **ninguna mutación ni el hub de SignalR la invalida**. Lo confirmé con grep: no hay ningún `invalidateQueries` sobre las keys de dashboard.
- En cambio, `useAccionesRequeridas` sí se refresca, porque se apoya en la lista de QE, que el hub y las mutaciones invalidan desde `pendientes-qe-asignacion-y-menus`.
- **Resultado:** después de firmar, aprobar o cerrar, la lista cambia pero las tarjetas del summary quedan desactualizadas hasta que el usuario vuelve a entrar.

### 1.4 El mismo patrón en otros roles

Los demás dashboards tienen tarjetas que enlazan con un ancla sin filtrar:

| Dashboard | Tarjetas afectadas |
|---|---|
| Supervisor | `esperanFirma` → `#acciones-requeridas`; `accionesCorrectivasVencidas` → `#acs-vencidas` |
| Auditor | `verificaciones` → `#acciones-requeridas` |
| Operario | `vencidas` y `porVencer` → `#mis-acs` |
| Alta Dirección | `acsConSolicitudAjustePlazo` → `#acs-extension-plazo` |

---

## 2. Decisiones de Toño

- **D1:** hacer clic en una tarjeta **filtra la lista de abajo** para mostrar exactamente esos ítems, con un chip para quitar el filtro. **El número de la tarjeta se calcula con el mismo arreglo que se muestra filtrado**, así siempre coinciden.
- **D2 — Interpretación de Cowork,** Toño respondió "ambos": la tarjeta cuenta **las dos cosas**, lo que espera la firma o la aprobación del JCA **y** los cierres en los que falta registrar el resultado. En la lista, esos casos se muestran como **pendientes separados**, para que se distingan:
  - `QE_APROBAR_CAUSA_RAIZ`: "Aprobar causa raíz";
  - `QE_FIRMAR_CIERRE_JCA`: "Firmar cierre (Jefe de Calidad)", cuando ya hay `resultadoCierre`, falta `cerradoPorId` y el estado es PENDIENTE_CIERRE;
  - `QE_REGISTRAR_CIERRE`: "Registrar resultado de cierre", con estado PENDIENTE_CIERRE y sin `resultadoCierre`.
  
  `QE_CERRAR` deja de existir y se reemplaza por los dos últimos. El título de la tarjeta pasa a ser **"Aprobaciones y cierres pendientes"**, porque "Esperan mi firma o aprobación" ya no describe todo lo que cuenta.

  > Si Toño quiso decir otra cosa, el cambio se reduce a quitar `QE_REGISTRAR_CIERRE` del conjunto de la tarjeta. Dejarlo anotado en `design.md`.
- **D3:** el bloque de AC de la columna lateral pasa a tener **dos pestañas: "Vencidas (n)" y "Por vencer (n)"**. La tarjeta "AC vencidas" abre la pestaña Vencidas, que lista **las mismas AC que cuenta el KPI-08**.
- **D4:** el summary se refresca **cuando llega una notificación en tiempo real** y **después de cada acción** (firmar, aprobar, asignar, cerrar, transicionar, cerrar una AC). No se agrega polling.

---

## 3. Qué implementar

### 3.1 Patrón común: la tarjeta filtra la lista y ambas usan el mismo arreglo

- **Estado del filtro:** guardarlo en la URL como `?alerta=<id>` (por ejemplo `?alerta=aprobaciones`), para que sobreviva a F5 y se pueda compartir. Leerlo y escribirlo con `useSearchParams`.
- **`AlertaCard`:**
  - acepta `onSelect?: () => void` y `activa?: boolean`, como alternativa a `to`;
  - si recibe `onSelect`, se renderiza como `<button>` y cambia `?alerta=`;
  - si está activa, muestra un anillo o borde de foco del color del nivel y `aria-pressed="true"`;
  - después de seleccionarla, hacer scroll suave a la lista destino.
  - Las tarjetas que llevan a **otra pantalla** (por ejemplo, "QE críticos" → `/quality-events?severidad=CRITICA`) siguen usando `to`.
- **Listas filtrables:**
  - `AccionesRequeridasWidget` acepta `filtroTipos?: AccionRequeridaTipo[]` y `etiquetaFiltro?: string`;
  - con filtro, muestra **todos** los ítems que coinciden, **sin** el corte de `VISIBLE_LIMIT`, y arriba un chip "Mostrando: {etiqueta} ({n}) ✕" que limpia `?alerta=`;
  - aplicar el mismo patrón a las demás listas que hoy son destino de un ancla (§1.4).
- **Una sola fuente por tarjeta:** cada página define una tabla:
  ```ts
  const ALERTAS = {
    aprobaciones: { tipos: ['QE_APROBAR_CAUSA_RAIZ', 'QE_FIRMAR_CIERRE_JCA', 'QE_REGISTRAR_CIERRE'], lista: 'acciones' },
    // …
  }
  ```
  - el `valor` de la tarjeta es `items.filter(i => tipos.includes(i.tipo)).length`, calculado con **el mismo** `items` que recibe la lista;
  - **prohibido** calcular el número de la tarjeta con una fuente y la lista con otra.

### 3.2 Pendientes de cierre del JCA (D2) — `utils/accionesRequeridas.utils.ts`

- Reemplazar el bloque `puedeCerrar` / `QE_CERRAR` por dos pendientes:
  - `QE_REGISTRAR_CIERRE`: `estado === 'PENDIENTE_CIERRE' && !qe.resultadoCierre`;
  - `QE_FIRMAR_CIERRE_JCA`: `estado === 'PENDIENTE_CIERRE' && !!qe.resultadoCierre && !qe.cerradoPorId`.
- Actualizar los tipos (`types/accionesRequeridas.types.ts`) e i18n, y quitar `QE_CERRAR`. Verificar con grep que no quede ningún uso.
- Revisar el Supervisor: su `esperanFirma` debe ser `QE_FIRMAR_CIERRE` (del área), filtrado de la misma lista.

### 3.3 AC vencidas y por vencer (D3)

**Backend**
- Agregar a `JefeCalidadDashboardData` (`DashboardSummaryDtos.cs`) el campo `AccionesCorrectivasVencidas: List<AccionCorrectivaResumen>`, calculado con **el mismo predicado que `CalcularKpi08`**. Extraer ese predicado a un helper compartido (por ejemplo, `DashboardKpiCalculator.EsAcVencida(...)`) y usarlo en los dos lugares, para que el KPI y la lista nunca diverjan.
- Esta lista va **completa** (sin límite de 10). Si se quiere limitar por rendimiento, el número de la tarjeta debe seguir saliendo del `Count` real, y la lista tiene que mostrar "ver todas" con un enlace al listado. Documentarlo en `design.md`.
- Hacer lo mismo con el Supervisor si su `accionesCorrectivasVencidas` usa otro criterio: el criterio debe ser el mismo, filtrado por área.

**Frontend**
- El bloque de AC de la columna lateral del JCA pasa a ser `ACsVencidasPorVencerWidget`, con pestañas **"Vencidas (n)"** y **"Por vencer (n)"**. Reutilizar las filas que ya renderizan `ACsPorVencerWidget` / `ACsVencidasWidget`.
- La pestaña activa también va en la URL (`?alerta=acVencidas` abre Vencidas).
- La tarjeta "AC vencidas" toma su valor de `summary.accionesCorrectivasVencidas.length` y deja de usar el KPI-08. El **anillo** del KPI-08 en la zona de indicadores sigue usando el KPI, que con el helper compartido ahora coincide.
- Revisar Operario (`vencidas` y `porVencer` → `#mis-acs`): la lista `MisACsWidget` se filtra con el mismo criterio que la tarjeta.

### 3.4 Refresco (D4)

- `DASHBOARD_QUERY_KEYS`: tener una key raíz (`['dashboard']`) para poder invalidar el summary y los KPIs juntos.
- **Hub** (`features/notifications/hooks/useNotificationsHub.ts`): al recibir **cualquier** notificación, invalidar `['dashboard']`, además de lo que ya se invalida.
- **Mutaciones:** en el `onSuccess` de estas mutaciones, invalidar también `['dashboard']`:
  - QE: crear, transicionar, asignar responsable, guardar análisis, aprobar causa raíz, iniciar cierre, firmar cierre, rechazar cierre, verificar eficacia, cambiar estado de una AC y cerrar una AC;
  - NC: cerrar una AC;
  - incidentes: crear y cerrar una AC;
  - documentos: transiciones, firmar, revisión periódica y copias controladas.
  
  Centralizarlo en un helper, por ejemplo `invalidarDashboard(queryClient)`, para no repetirlo.
- Mantener `refetchOnWindowFocus` (default de TanStack). **Sin polling.**

### 3.5 i18n (`dashboard`, es-PE y en-US)

| Clave | es-PE | en-US |
|---|---|---|
| `alertas.jefeCalidad.aprobaciones` | Aprobaciones y cierres pendientes | Pending approvals and closures |
| `accionesRequeridas.tipo.QE_FIRMAR_CIERRE_JCA` | Firmar cierre (Jefe de Calidad) | Sign closure (Quality Manager) |
| `accionesRequeridas.tipo.QE_REGISTRAR_CIERRE` | Registrar resultado de cierre | Record closure result |
| `accionesRequeridas.mostrando` | Mostrando: {{etiqueta}} ({{n}}) | Showing: {{etiqueta}} ({{n}}) |
| `accionesRequeridas.quitarFiltro` | Quitar filtro | Clear filter |
| `acs.tabs.vencidas` | Vencidas ({{n}}) | Overdue ({{n}}) |
| `acs.tabs.porVencer` | Por vencer ({{n}}) | Due soon ({{n}}) |

Quitar `accionesRequeridas.tipo.QE_CERRAR` y `alertas.jefeCalidad.esperanFirma`.

### 3.6 MSW

- Agregar `accionesCorrectivasVencidas` al summary del JCA en los fixtures.
- Los fixtures de QE deben tener casos de PENDIENTE_CIERRE con y sin `resultadoCierre`.

---

## 4. Tests

**Backend**
- `AccionesCorrectivasVencidas.Count` es igual al valor del KPI-08 para el mismo set de datos, con AC vencidas en QE, NC e incidentes, AC cerradas y AC de otra empresa.

**Frontend**
- Para **cada** dashboard: con un set de fixtures, el número de cada tarjeta es igual a la cantidad de filas que muestra la lista al hacer clic en esa tarjeta. Es un test parametrizado por tarjeta.
- Con `?alerta=aprobaciones`, la lista muestra **todos** los ítems de los tres tipos (aunque sean más de 10) y el chip. Al quitar el filtro, se limpia la URL.
- `QE_REGISTRAR_CIERRE` y `QE_FIRMAR_CIERRE_JCA` salen en los casos correctos, y `QE_CERRAR` ya no existe.
- Pestañas de AC: la tarjeta abre Vencidas, y los contadores de las pestañas coinciden con las filas.
- Refresco:
  - un evento simulado del hub invalida `['dashboard']`;
  - el `onSuccess` de aprobar causa raíz y el de firmar cierre lo invalidan;
  - la tarjeta cambia sin recargar.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado**, como JCA:
  1. Anotar el número de "Aprobaciones y cierres pendientes" y hacer clic en la tarjeta. La lista muestra **exactamente** esa cantidad de filas, cada una con su tipo: Aprobar causa raíz, Firmar cierre o Registrar resultado. Aparece el chip, y con ✕ vuelve la lista completa.
  2. Aprobar una causa raíz con PIN y volver al dashboard (o quedarse en él). La tarjeta baja en 1 **sin recargar**.
  3. Hacer clic en "AC vencidas": se abre la pestaña Vencidas con la misma cantidad que la tarjeta y que el anillo del KPI-08.
  4. En otra sesión, como SUP, firmar un cierre. En la sesión del JCA llega la notificación y las tarjetas se actualizan solas.
  5. Repetir el paso 1 con las tarjetas de Supervisor, Operario, Auditor y Alta Dirección.
  6. F5 con `?alerta=…` en la URL: el filtro se mantiene.
- Toño avisa con **"listo"** para que Cowork verifique.
