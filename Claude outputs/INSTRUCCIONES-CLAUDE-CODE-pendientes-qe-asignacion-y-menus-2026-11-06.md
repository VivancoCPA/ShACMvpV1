# INSTRUCCIONES PARA CLAUDE CODE — Pendientes de QE según la asignación, y menús desplegables que se cierran al hacer clic afuera

- **Fecha:** 2026-11-06
- **Autor:** Cowork (para Toño)
- **Origen:** dos observaciones de Toño:
  1. Un QE asignado al Jefe de Calidad no aparece en los pendientes de su dashboard, aunque sí en las notificaciones.
  2. Los menús desplegables (la lista de notificaciones y los otros) solo se cierran al volver a hacer clic en el mismo botón; deberían cerrarse al hacer clic afuera.
- **Change OpenSpec:** `pendientes-qe-asignacion-y-menus`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Solo frontend + i18n.** Sin cambios en el backend ni migración.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 Los pendientes no consideran al responsable de investigación

- El widget "Acciones requeridas" (`features/dashboard/components/AccionesRequeridasWidget.tsx`) usa `useAccionesRequeridas`. Ese hook trae hasta 200 QE, NC, incidentes y documentos y llama a `extraerAccionesQE` (`features/dashboard/utils/accionesRequeridas.utils.ts:16`).
- `extraerAccionesQE` genera, para el **JCA**:
  - `QE_CAUSA_RAIZ` para **todo** QE en EN_INVESTIGACION o ANALISIS_COMPLETADO sin firma, sea o no responsable;
  - `QE_CERRAR`;
  - `QE_VERIFICAR`.

  Para **SUPERVISOR o ALTA_DIRECCION** genera solo `QE_FIRMAR_CIERRE`, y para **AUDITOR** solo `QE_VERIFICAR`.
- **No mira nunca `responsableInvestigacionId`.** Ese campo se agregó en `qe-precarga-incidente-responsable`, y el listado ya lo devuelve (`ListarQualityEventsHandler.cs:21`). La consecuencia: un QE en **ABIERTO** asignado a alguien no genera ningún pendiente, y un SUPERVISOR responsable no ve su investigación.
- El aviso de asignación sí se envía (`NotificarResponsableAsignadoAsync`). Por eso aparece en la campana.

### 1.2 Los menús no se cierran al hacer clic afuera

- `components/layout/TopNav.tsx`:
  - `dropdownOpen` (menú de usuario), línea 28, con toggle en la 158;
  - `empresaDropdownOpen` (selector de empresa), línea 29, con toggle en la 91.
- `features/notifications/components/NotificationBell.tsx`: `open`, línea 16, con toggle en la 28.
- Los tres son un `useState` con toggle. Ninguno escucha clics afuera ni Escape, ni se cierra al navegar.

---

## 2. Decisiones de Toño

- **D1:** los pendientes de QE se calculan **por asignación**, más las tareas propias del JCA:

  | Quién | Pendiente | Condición |
  |---|---|---|
  | Responsable asignado (sea JCA o SUP) | `QE_INICIAR_INVESTIGACION` "Iniciar investigación" | `estado === 'ABIERTO'` y `responsableInvestigacionId === user.id` |
  | Responsable asignado | `QE_COMPLETAR_ANALISIS` "Completar análisis" | `estado === 'EN_INVESTIGACION'` y `responsableInvestigacionId === user.id` |
  | JCA | `QE_ASIGNAR_RESPONSABLE` "Asignar responsable" | `estado === 'ABIERTO'` y sin `responsableInvestigacionId` |
  | JCA | `QE_APROBAR_CAUSA_RAIZ` "Aprobar causa raíz" | `estado` EN_INVESTIGACION o ANALISIS_COMPLETADO, `causaRaizDefinitiva` de 100 caracteres o más y `!causaRaizFirmadaEn`. Aplica a **cualquier** QE, porque aprobar es tarea del JCA |
  | JCA | `QE_CERRAR`, `QE_VERIFICAR` | Sin cambios |
  | SUP o ALTA_DIRECCION | `QE_FIRMAR_CIERRE` | Sin cambios (ya filtra por área) |
  | Auditor | `QE_VERIFICAR` | Sin cambios |

- `QE_CAUSA_RAIZ`, tal como existe hoy (todos los QE en investigación para el JCA), **se elimina**. Lo reemplazan `QE_COMPLETAR_ANALISIS`, que se basa en la asignación, y `QE_APROBAR_CAUSA_RAIZ`.
- **Menús:** los tres se cierran al hacer clic afuera, al presionar **Escape** y al **navegar** a otra ruta.

---

## 3. Qué implementar (todo en `shc-controldoc/src/`)

### 3.1 Pendientes (`features/dashboard/`)

**`utils/accionesRequeridas.utils.ts` → `extraerAccionesQE`**

- Implementar la tabla de D1. Cada QE puede generar **más de un** pendiente para el mismo usuario. Por ejemplo, un JCA responsable de un QE en EN_INVESTIGACION con una causa raíz de 100 caracteres o más ve `QE_COMPLETAR_ANALISIS` y `QE_APROBAR_CAUSA_RAIZ`. Eso está bien; mantener ids únicos con el formato `QE-{tipo}-{qe.id}`.
- La regla del responsable se evalúa **antes** del `switch` por rol y vale para cualquier rol.
- Excluir los QE eliminados (`deletedAt`), si el listado los trae.
- **Prioridad:** usar `qeSeveridadPrioridad(qe)`, como hoy. Para `QE_ASIGNAR_RESPONSABLE` e `QE_INICIAR_INVESTIGACION`, subir a `'alta'` si el QE lleva más de **48 h** en ABIERTO, contadas desde `fechaHoraReporte` (o desde `creadoEn` si no está). Ese es el plazo del PRD §1.3 ("48 h para ser asignado a investigación"). Solo afecta la prioridad visual; no genera avisos.

**`types/accionesRequeridas.types.ts`**

- Agregar `QE_INICIAR_INVESTIGACION`, `QE_COMPLETAR_ANALISIS`, `QE_ASIGNAR_RESPONSABLE` y `QE_APROBAR_CAUSA_RAIZ`.
- Quitar `QE_CAUSA_RAIZ`. Verificar con grep que no quede ningún uso.

**Actualización inmediata**

- Asignar o cambiar el responsable, transicionar, guardar el análisis y aprobar la causa raíz deben invalidar la query de la lista de QE que usa `useAccionesRequeridas` (`useQualityEvents` con `page: 1, pageSize: 200`). Revisar que cada mutación invalide `['quality-events', 'list']` o la key equivalente. Si no lo hace, agregarlo.
- **Recomendado:** cuando llega por SignalR una notificación de `EntidadTipo = QE` (`useNotificationsHub.ts`), invalidar también la lista de QE. Así el pendiente aparece al mismo tiempo que la notificación, sin recargar. Hoy ya se hace algo parecido para `DOCUMENTO` (línea 42).

### 3.2 Menús desplegables

**Hook nuevo `hooks/useDismissable.ts`** (o `components/shared/`, donde estén los hooks compartidos):

```ts
export function useDismissable(
  open: boolean,
  onClose: () => void,
  refs: React.RefObject<HTMLElement | null>[], // el panel y el botón que lo abre
): void
```

- Mientras `open` sea true:
  - escuchar `mousedown` y `touchstart` en `document`; si el target no está dentro de ninguno de los `refs`, llamar a `onClose()`;
  - escuchar `keydown` en `document`; con `Escape`, llamar a `onClose()` y devolver el foco al botón (`refs[1]` o el que corresponda).
- **Incluir el botón en `refs`.** Si no, el `mousedown` en el botón cierra el panel y después el `onClick` del toggle lo vuelve a abrir.
- Limpiar los listeners al cerrar o desmontar.
- **Cerrar al navegar:** en cada componente, un `useEffect` sobre `location.pathname` (`useLocation`) que llame a `onClose()`.

**Aplicarlo en:**
- `TopNav.tsx`: el menú de usuario y el selector de empresa. Si uno se abre, el otro se cierra.
- `NotificationBell.tsx`: el panel de notificaciones. Hacer clic en una notificación navega, y con eso el panel se cierra.
- **Buscar con grep otros desplegables con el mismo patrón** y aplicarles el hook. Por ejemplo, el menú "⋯" de acciones en el detalle del documento (`detalle-documento-dos-columnas`) o filtros con popover. Los combobox (`SearchableSelect` y los de documentos y normativa) **ya** manejan `mousedown`: no tocarlos.
- **Modales:** quedan fuera de este cambio, porque ya cierran con Escape y con el fondo.

**Accesibilidad:** el botón lleva `aria-expanded={open}` y `aria-haspopup="menu"` (o `"dialog"` en el panel de notificaciones), y el panel un `id` referenciado con `aria-controls`.

### 3.3 i18n (`dashboard`, es-PE y en-US), en `accionesRequeridas.tipo`

| Clave | es-PE | en-US |
|---|---|---|
| `QE_INICIAR_INVESTIGACION` | Iniciar investigación | Start investigation |
| `QE_COMPLETAR_ANALISIS` | Completar análisis | Complete analysis |
| `QE_ASIGNAR_RESPONSABLE` | Asignar responsable | Assign lead |
| `QE_APROBAR_CAUSA_RAIZ` | Aprobar causa raíz | Approve root cause |

Quitar `QE_CAUSA_RAIZ`.

---

## 4. Tests (Vitest)

**`accionesRequeridas.utils.test.ts`** (crear o ampliar)
- QE ABIERTO con `responsableInvestigacionId = JCA`: el JCA recibe `QE_INICIAR_INVESTIGACION` y **no** `QE_ASIGNAR_RESPONSABLE`.
- QE ABIERTO sin responsable: el JCA recibe `QE_ASIGNAR_RESPONSABLE`; el SUP no recibe nada.
- QE ABIERTO con responsable = SUP A: A recibe `QE_INICIAR_INVESTIGACION`; el SUP B no; el JCA no recibe `QE_INICIAR_INVESTIGACION`.
- QE EN_INVESTIGACION con responsable SUP A: A recibe `QE_COMPLETAR_ANALISIS`; el JCA no lo recibe, pero sí recibe `QE_APROBAR_CAUSA_RAIZ` cuando la causa raíz tiene 100 caracteres o más y no está firmada.
- Con la causa raíz firmada: no hay `QE_APROBAR_CAUSA_RAIZ`.
- Un QE ABIERTO desde hace 50 h tiene prioridad `'alta'`.
- Regresiones: `QE_CERRAR`, `QE_VERIFICAR` y `QE_FIRMAR_CIERRE` siguen saliendo igual.

**`useDismissable`**
- Hacer clic afuera cierra el panel; hacer clic adentro o en el botón no lo cierra por el hook.
- Escape lo cierra y devuelve el foco al botón.
- Sin `open`, no hay listeners activos.

**Componentes**
- `NotificationBell`: abrir, hacer clic en el `body` y verificar que se cerró; con Escape, también.
- `TopNav`: al abrir el selector de empresa con el menú de usuario abierto, el menú se cierra; al cambiar de ruta, se cierra todo.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- No hay cambios de backend, así que no hace falta reiniciarlo. Ctrl+F5 en el navegador.
- **Prueba manual con MSW apagado:**
  1. Como JCA, crear un QE y asignarte como responsable. En el dashboard aparece "Iniciar investigación" **sin recargar**, al mismo tiempo que la notificación.
  2. Crear un QE sin responsable: el JCA ve "Asignar responsable". Asignarlo a un SUPERVISOR: el pendiente del JCA desaparece, y el SUPERVISOR (en otra sesión) ve "Iniciar investigación".
  3. Como el SUPERVISOR, iniciar la investigación: su pendiente pasa a "Completar análisis". Completar el análisis con una causa raíz de 100 caracteres o más y guardar: el JCA ve "Aprobar causa raíz".
  4. Abrir la campana y hacer clic en cualquier parte de la página: se cierra. Abrirla y presionar Escape: se cierra. Abrirla y hacer clic en una notificación: navega y se cierra.
  5. Lo mismo con el menú de usuario y con el selector de empresa. Abrir uno con el otro abierto: queda solo uno.
- Toño avisa con **"listo"** para que Cowork verifique.
