## Context

- `extraerAccionesQE` (`features/dashboard/utils/accionesRequeridas.utils.ts`) genera pendientes de QE solo por rol: el JCA recibe `QE_CAUSA_RAIZ` por todo QE en investigación, y nunca se mira `responsableInvestigacionId` (que el listado ya devuelve). Un QE en `ABIERTO` asignado no genera ningún pendiente.
- `TopNav.tsx` (menú de usuario, selector de empresa), `NotificationBell.tsx`, `DocumentManagementActions.tsx` (menú "⋯") y `SyncQueueBadge.tsx` (panel de la cola offline) abren un panel con un `useState` toggle. Solo el "⋯" se cierra con clic afuera, mediante un overlay `fixed inset-0`. Ninguno se cierra con Escape ni al navegar.
- Todas las mutaciones relevantes ya invalidan `['quality-events', 'list']`: `useAsignarResponsableQE`, `useTransitionQEStatus`, `useUpdateQualityEvent` (guardar análisis), `useAprobarCausaRaiz`, y `useCreateQualityEvent` (que invalida `['quality-events']`). No hace falta agregar ninguna.

## Goals / Non-Goals

**Goals:** los pendientes de QE se calculan por asignación (D1 de la instrucción); el pendiente aparece sin recargar al mismo tiempo que la notificación; los menús se cierran con clic afuera, con Escape y al navegar.

**Non-Goals:** backend; modales; combobox; push SignalR para tipos no urgentes.

## Decisions

### D1 — Reglas por asignación antes del `switch` por rol
Las reglas del responsable (`QE_INICIAR_INVESTIGACION` y `QE_COMPLETAR_ANALISIS`) se evalúan primero y valen para cualquier rol. Las reglas del JCA agregan `QE_ASIGNAR_RESPONSABLE` y `QE_APROBAR_CAUSA_RAIZ`. Se usa un helper local `pushQE(tipo, extra?)` para no repetir el objeto `AccionRequerida` siete veces.

El umbral de causa raíz es `causaRaizDefinitiva.trim().length >= 100`. Es el mismo criterio que `causaRaizSchema` en `QEInvestigationSection.tsx:42`, que también hace `trim` antes de `safeParse`.

### D2 — Prioridad por antigüedad en ABIERTO
La fecha base es `fechaHoraReporte ?? creadoEn`. En el tipo, `fechaHoraReporte` es obligatorio, pero el fallback protege contra datos incompletos. El cálculo usa `Date.now()`, igual que `extraerAccionesDocumento`. El umbral es `48 * 3600 * 1000` ms.

### D3 — La invalidación también sale de la ruta de polling (divergencia)
La instrucción recomienda invalidar desde `useNotificationsHub.ts`. Pero el backend solo empuja por SignalR `SEVERIDAD_CRITICA` y `CIERRE` (`QualityEventNotificationSender.cs:152`). El aviso de asignación de responsable (`ASIGNACION`) llega **solo por polling** (`useNotifications`, `refetchInterval` de 60 s). Si la invalidación estuviera solo en el hub, el pendiente del Supervisor asignado no aparecería junto con la notificación.

Por eso se crea `features/notifications/utils/invalidarQueriesDeEntidad.ts`. Para QE invalida `['quality-events','list']` y el detalle; para DOCUMENTO, `documents.detail` y `documents.all`, tal como hoy en el hub. Lo llaman:
- `useNotificationsHub`, que reemplaza el bloque inline de DOCUMENTO;
- `useNotificationToast`, sobre el arreglo `fresh` de notificaciones nuevas detectadas, ya excluida la baseline inicial.

Como efecto lateral, las notificaciones de documento no urgentes ahora también refrescan el documento cuando llegan por polling. Es inocuo y coherente.

En la propia sesión (por ejemplo, el JCA se asigna a sí mismo) la mutación ya invalida la lista, así que el pendiente aparece de inmediato.

### D4 — Cerrar al navegar sin `useEffect` (divergencia)
La instrucción propone un `useEffect` sobre `location.pathname` que llame a `onClose()`. Ese patrón (setState dentro de un effect) contradice la regla de arquitectura 1 de CLAUDE.md, y `eslint-plugin-react-hooks` v7 (`set-state-in-effect`) lo marca. En su lugar, cada panel guarda **la ruta en la que se abrió**:

```ts
const { pathname } = useLocation()
const [openAt, setOpenAt] = useState<string | null>(null)
const open = openAt === pathname   // navegar ⇒ open pasa a false sin efecto
```

Se encapsula en el mismo archivo `hooks/useDismissable.ts`:
- `useRouteScopedMenu<K>()` devuelve `{ openKey, toggle(key), close }` para varios paneles excluyentes. Lo usa `TopNav`.
- `useRouteScopedOpen()` es la variante de un solo panel y devuelve `{ open, toggle, close }`.

Hay un caso límite: navegar A→B→A sin que nada haya llamado a `close()` haría reaparecer el panel. Se mitiga de dos formas:
- Toda navegación iniciada fuera del panel (sidebar, enlaces) pasa antes por un `mousedown` afuera, que cierra el panel.
- Los ítems que navegan desde dentro del panel llaman a `close()`. `NotificationList` recibe un `onNavigate` opcional, y `NotificationBell` le pasa `close`.

Solo queda la navegación con el historial del navegador (atrás/adelante dos veces) con el panel abierto, que es aceptable.

### D5 — `useDismissable` con listeners en `document`
La firma es la de la instrucción: `refs = [panelRef, triggerRef]`. Los listeners son `mousedown` + `touchstart` + `keydown`, se registran solo con `open` y se limpian en el cleanup. Es una suscripción a un sistema externo, que es uso legítimo de `useEffect`, no derivación de estado. `onClose` se guarda en una ref para no re-suscribirse en cada render.

### D6 — Alcance de los menús
- `TopNav`: los dos menús se vuelven exclusivos con un único `openMenu: 'usuario' | 'empresa' | null`, scoped a la ruta. Cada menú lleva su propio `useDismissable`.
- `DocumentManagementActions`: se quita el overlay invisible y se reemplaza por el hook (que suma Escape y la navegación).
- `SyncQueueBadge`: el mismo tratamiento.
- Fuera de alcance: los combobox, que ya manejan `mousedown`; los modales; y los toggles de colapso (`setInvestigacionOpen`, `setAuditOpen`, `setShowPassword` y similares), que no son desplegables flotantes.

### D7 — ARIA
Cada trigger lleva `aria-expanded`, `aria-haspopup` (`"menu"` en el usuario, la empresa y el "⋯"; `"dialog"` en la campana y la cola offline) y `aria-controls`. El panel lleva el `id` generado con `useId()`.

### D8 — Clave i18n nueva `nav:userMenu`
El botón del menú de usuario no tenía `aria-label`, y en mobile solo muestra el avatar. Se agrega `aria-label={t('nav:userMenu')}`: "Menú de usuario" / "User menu".

## Verificación — estado previo al change (no introducido aquí)

Se comparó contra un worktree limpio de HEAD (`4c7f850`):
- **Frontend tests:** fallan los mismos 2 tests en HEAD y con el change: `JefeCalidadDashboard.test.tsx` ("AC por vencer de prueba") y `documentReplaceOriginal.test.tsx` (SUPERVISOR revisor ve "descargar original"). `useEditarSeveridad` "404" falló una vez en la suite completa y pasa en aislamiento, así que es flaky por carga.
- **`tsc --noEmit -p tsconfig.app.json`:** 17 errores en HEAD y 17 con el change, todos en fixtures, handlers y tipos de documentos.
- **`npm run lint`:** 48 errores en HEAD. Con el change hay 56, pero 9 vienen de `dev-dist/workbox-*.js`, un artefacto generado que no está en el worktree. Sin él quedan 47. Ninguno está en archivos tocados por este change.

La regla "lint con cero errores" no se cumple a nivel repo por esa deuda previa, que queda fuera de alcance. Los archivos de este change pasan lint y tsc limpios.

## Risks / Trade-offs

- [Invalidar por cada notificación nueva puede refetchear la lista de 200 QE] → Solo pasa ante notificaciones nuevas, que son poco frecuentes, y TanStack deduplica.
- [Quitar `QE_CAUSA_RAIZ` cambia el pendiente que el JCA veía en todo QE en investigación] → Es lo decidido (D1). El JCA solo lo ve cuando es responsable o cuando hay algo que aprobar.
- [El fixture del test de export usa `QE_CAUSA_RAIZ`] → Se cambia a `QE_APROBAR_CAUSA_RAIZ`.
