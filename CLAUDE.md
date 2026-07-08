# SHAC — Contexto del Proyecto

**SHAC** (Sistema Híbrido de Acciones Correctivas/Preventivas y Control Documentario) es una aplicación de gestión de calidad y SyST para un operador logístico de almacén de minerales (importación/exportación). Normas base: ISO 9001:2015 §7.5 + ISO 45001:2018 §10.2. Idioma UI: `es-PE` (default) + `en-US`.

---

## Stack Tecnológico — No Negociable

| Capa              | Tecnología                                                           |
| ----------------- | -------------------------------------------------------------------- |
| Framework         | React 19 + TypeScript + Vite (CSR)                                   |
| Estilos           | Tailwind CSS con design system custom (ver Design System)            |
| HTTP / Caché      | Axios + TanStack Query v5                                            |
| Estado global     | Zustand                                                              |
| Formularios       | React Hook Form + Zod                                                |
| Rutas             | React Router v6+ con `<RoleGuard>`                                   |
| i18n              | react-i18next — `es-PE` default, `en-US` soporte                     |
| Notificaciones    | Sonner (`toast`) — nunca `alert()` o `confirm()`                     |
| Mock API          | MSW v2 — activo solo con `VITE_ENABLE_MSW=true`                      |
| Backend (externo) | .NET 10 Web API + PostgreSQL — **AÚN NO EXISTE**                     |
| Auth              | JWT Bearer (accessToken en Zustand, refreshToken en httpOnly cookie) |

**Nunca sugerir** Next.js, Vue, Angular, SvelteKit u otro framework alternativo.

---

## Reglas de Arquitectura — Obligatorias

1. **Sin `useEffect` para derivar estado.** Usar `useMemo`, TanStack Query, o Zustand.
2. **Formularios:** siempre React Hook Form + schema Zod. Nunca `useState` manual para campos.
3. **HTTP:** solo vía hooks de TanStack Query (`useQuery`, `useMutation`). Nunca `axios` directo en componentes.
4. **Strings de UI:** siempre `t('namespace:clave')`. Nunca texto en español hardcodeado en JSX.
5. **Fechas:** `Intl.DateTimeFormat(locale, opts)` o `date-fns` con locale. Nunca `.toLocaleDateString()` sin locale explícito.
6. **TypeScript:** tipado estricto siempre. Nunca `any`; usar `unknown` cuando el tipo no es conocido.
7. **Dark mode:** toda clase Tailwind debe tener su variante `dark:` correspondiente.
8. **Roles:** verificar rol desde `authStore` antes de renderizar acciones protegidas.
9. **Listas largas:** virtualización o paginación obligatoria.
10. **Accesibilidad:** botones sin texto → `aria-label`. Inputs → `<label>` asociado.
11. **Error boundaries:** cada feature necesita su `ErrorBoundary`.
12. **Audit trail:** toda mutación de estado debe registrar un `AuditTrailEntry` (append-only, nunca editable en UI).
13. **MSW obligatorio:** todo nuevo módulo incluye sus handlers en `src/mocks/handlers/[modulo].handlers.ts`. Nunca datos hardcodeados en componentes o hooks.
14. **Reglas de negocio:** no generar código que viole `RN-QE-*` ni `RN-DOC-*`.

---

## Estructura de Carpetas

```
src/
├── api/                  # Clientes Axios por dominio
│   └── endpoints/        # Endpoints por módulo
├── mocks/                # MSW — solo en development
│   ├── browser.ts
│   ├── handlers/         # [modulo].handlers.ts + index.ts
│   └── fixtures/         # [modulo].fixtures.ts + index.ts
├── components/
│   ├── ui/               # Componentes atómicos del design system
│   ├── layout/           # Shell, Sidebar, TopNav, PageWrapper
│   └── shared/           # StatusBadge, UserAvatar, SeverityTag
├── features/
│   ├── documents/        # M1 — Control Documentario (activo)
│   ├── nonconformities/  # M2 — No Conformidades
│   ├── incidents/        # M3 — Incidentes SyST
│   ├── quality-events/   # M4 — Quality Event (núcleo)
│   ├── dashboard/        # M5 — Dashboard e Indicadores
│   └── users/            # M6 — Usuarios y Roles
├── hooks/                # useDebounce, useLocalStorage, useDarkMode
├── i18n/                 # es-PE.json, en-US.json + config
├── lib/                  # axios instance, queryClient, zod schemas base
├── stores/               # authStore, uiStore, preferencesStore
├── types/                # Tipos globales y DTOs del backend
└── utils/                # Formatters, date helpers, validators
```

### Convención de nombrado

| Tipo              | Patrón                                                |
| ----------------- | ----------------------------------------------------- |
| Componentes React | `PascalCase.tsx`                                      |
| Hooks             | `useCamelCase.ts`                                     |
| Stores            | `camelCaseStore.ts`                                   |
| Tipos             | `camelCase.types.ts`                                  |
| API               | `camelCase.api.ts`                                    |
| Schemas Zod       | `camelCase.schema.ts` en `features/[modulo]/schemas/` |
| Tests             | `ComponentName.test.tsx` junto al archivo fuente      |

---

## Entidad Central — Quality Event (QE)

### Máquina de estados (estricta)

```
ABIERTO → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION
        → PENDIENTE_CIERRE → CERRADO → EN_VERIFICACION
        → VERIFICADO  (terminal positivo)
        → REABIERTO   (terminal negativo — reinicia ciclo, incrementa `ciclo`)
```

### Tipos TypeScript

```typescript
type QEStatus =
  | "ABIERTO"
  | "EN_INVESTIGACION"
  | "ANALISIS_COMPLETADO"
  | "EN_EJECUCION"
  | "PENDIENTE_CIERRE"
  | "CERRADO"
  | "EN_VERIFICACION"
  | "VERIFICADO"
  | "REABIERTO";
type QEOrigin =
  | "O1_INCIDENTE_CAMPO"
  | "O2_NC_DETECTADA"
  | "O3_HALLAZGO_AUDITORIA"
  | "O4_REPORTE_EXTERNO";
type QEType = "CALIDAD" | "SST" | "ADUANERO" | "OPERACIONAL";
type QESeverity = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

interface QualityEvent {
  id: string;
  numero: string; // QE-2025-001
  origen: QEOrigin;
  tipo: QEType;
  severidad: QESeverity;
  estado: QEStatus;
  ciclo: number; // 1 = primer ciclo, 2+ = reaperturas
  descripcion: string; // No editable después de salir de ABIERTO
  areaAfectada: string;
  mineralInvolucrado?: string;
  turno: "DIA" | "TARDE" | "NOCHE";
  fechaEvento: string; // ISO 8601
  fechaReporte: string; // ISO 8601
  reportadoPorId: string;
  responsableInvestigacionId?: string;
  causaRaizDefinitiva?: string;
  causaRaizAprobadaPorId?: string;
  resultadoCierre?: string;
  plazoVerificacionDias?: number;
  resultadoVerificacion?: "EFECTIVO" | "NO_EFECTIVO";
  accionesCorrectivas: AccionCorrectiva[];
  documentosVinculados: string[];
  adjuntos: Adjunto[];
  auditTrail: AuditTrailEntry[];
  creadoEn: string;
  actualizadoEn: string;
}
```

### Reglas de negocio QE — Invariantes

| ID        | Regla                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------- |
| RN-QE-001 | Un QE está en un solo estado a la vez. Transiciones son inmutables en audit trail.             |
| RN-QE-002 | No puede avanzar a `EN_EJECUCION` sin `causaRaizDefinitiva` aprobada y firmada.                |
| RN-QE-003 | No puede cerrarse si hay ACs en `PENDIENTE` o `EN_EJECUCION` sin evidencia.                    |
| RN-QE-004 | Cierre requiere firma dual: Jefe Calidad + Supervisor. Si misma persona → aprobación Gerencia. |
| RN-QE-005 | Severidad `CRITICA` → notificar a Gerencia en < 2 minutos.                                     |
| RN-QE-006 | `descripcion` no editable una vez fuera de `ABIERTO`. Correcciones van a bitácora.             |
| RN-QE-007 | QE reabierto conserva historial completo. `ciclo` se incrementa en 1.                          |
| RN-QE-008 | Verificación no completada en 10 días hábiles → reapertura automática y escalada a Gerencia.   |

---

## Módulo M1 — Control Documentario (activo)

### Tipos TypeScript

```typescript
type DocStatus =
  | "BORRADOR"
  | "EN_REVISION"
  | "EN_APROBACION"
  | "PUBLICADO"
  | "OBSOLETO"
  | "EN_REVISION_PERIODICA";
type DocType = "POL" | "PRC" | "INS" | "REG" | "INF" | "MAT" | "PLAN";

interface Documento {
  id: string;
  codigo: string; // PRC-CD-001
  titulo: string;
  tipo: DocType;
  version: string; // v1.0, v1.1, v2.0
  estado: DocStatus;
  area: string;
  autorId: string;
  revisorId?: string;
  aprobadorId?: string;
  fechaEmision?: string;
  fechaVigencia?: string;
  fechaRevisionProxima?: string;
  archivoUrl?: string;
  hashArchivo?: string; // SHA-256 del archivo firmado
  qeVinculados: string[]; // IDs de QEs que referencian este documento
  historialVersiones: VersionEntry[];
  auditTrail: AuditTrailEntry[];
}
```

### Flujo de estados

```
BORRADOR → EN_REVISION → EN_APROBACION → PUBLICADO
               ↓ (rechazo)                   ↓ (nueva versión)
           BORRADOR                       OBSOLETO (versión anterior)
PUBLICADO → EN_REVISION_PERIODICA → BORRADOR (versión N+1)
```

### Permisos por estado y rol

| Estado        | Autor             | Revisor                       | Aprobador         | Jefe Calidad               | Operario   |
| ------------- | ----------------- | ----------------------------- | ----------------- | -------------------------- | ---------- |
| BORRADOR      | Editar · Eliminar | Lectura                       | Lectura           | Editar · Comentar          | Sin acceso |
| EN_REVISION   | Lectura           | Aprobar · Rechazar · Comentar | Lectura           | Editar · Comentar          | Sin acceso |
| EN_APROBACION | Lectura           | Lectura                       | Firmar · Rechazar | Lectura                    | Sin acceso |
| PUBLICADO     | Sin acceso        | Lectura                       | Lectura           | Lectura · Iniciar revisión | Lectura    |
| OBSOLETO      | Sin acceso        | Lectura                       | Lectura           | Lectura                    | Sin acceso |

### Reglas de negocio M1 — Invariantes

| ID         | Regla                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| RN-DOC-001 | Solo una versión `PUBLICADA` por código. Al publicar → anterior pasa a `OBSOLETO` automáticamente.           |
| RN-DOC-002 | Versión menor (v1.0→v1.1) = cambios de forma. Versión mayor (v1.x→v2.0) = cambio sustancial. El autor elige. |
| RN-DOC-003 | Documento `OBSOLETO` → solo lectura. PDF exportado lleva marca de agua "OBSOLETO — No usar".                 |
| RN-DOC-004 | Firma de aprobación requiere contraseña/PIN. Registra: usuario, timestamp, hash SHA-256.                     |
| RN-DOC-005 | No se puede obsoletizar un documento vinculado a un QE activo (estado ≠ `CERRADO` o `VERIFICADO`).           |
| RN-DOC-006 | Alerta antes de la fecha de revisión periódica (default 30 días, configurable por tipo).                     |

---

## Módulos del Sistema

| ID  | Módulo                      | Directorio                  | Estado          |
| --- | --------------------------- | --------------------------- | --------------- |
| M1  | Control Documentario        | `features/documents/`       | En construcción |
| M2  | Gestión de No Conformidades | `features/nonconformities/` | Pendiente       |
| M3  | Gestión de Incidentes SyST  | `features/incidents/`       | Pendiente       |
| M4  | Quality Event (núcleo)      | `features/quality-events/`  | Pendiente       |
| M5  | Dashboard e Indicadores     | `features/dashboard/`       | Pendiente       |
| M6  | Gestión de Usuarios y Roles | `features/users/`           | Pendiente       |

---

## Design System — Estilo Claude

Basado en el design system de Claude.com, adaptado para gestión empresarial con Dark Mode.

### Paleta de colores (tokens Tailwind — `tailwind.config.ts`)

```javascript
colors: {
  // Superficies
  canvas:                  '#faf9f5',  // Fondo default (Light)
  'surface-soft':          '#f5f0e8',
  'surface-card':          '#efe9de',
  'surface-cream':         '#e8e0d2',
  'surface-dark':          '#181715',  // Fondo default (Dark)
  'surface-dark-elevated': '#252320',
  'surface-dark-soft':     '#1f1e1b',
  // Marca
  coral:                   '#cc785c',  // CTA primario
  'coral-dark':            '#a9583e',  // Hover / active
  'coral-muted':           '#e6dfd8',  // Disabled
  // Texto
  ink:                     '#141413',
  'body-strong':           '#252523',
  body:                    '#3d3d3a',
  muted:                   '#6c6a64',
  'muted-soft':            '#8e8b82',
  'on-dark':               '#faf9f5',
  'on-dark-soft':          '#a09d96',
  // Bordes
  hairline:                '#e6dfd8',
  'hairline-soft':         '#ebe6df',
  // Accentos
  teal:                    '#5db8a6',
  amber:                   '#e8a55a',
  // Semánticos
  success:                 '#5db872',
  warning:                 '#d4a017',
  error:                   '#c64545',
}
```

### Dark Mode

- Detectar con `prefers-color-scheme: dark`. Persistir en `localStorage` con clave `shac-theme`.
- Estrategia Tailwind: `darkMode: 'class'` (clase `dark` en `<html>`).
- Mapeo en dark: `canvas` → `surface-dark`, `text-ink` → `on-dark`, cards → `surface-dark-elevated`.

### Tipografía

| Uso              | Fuentes                                              | Notas                               |
| ---------------- | ---------------------------------------------------- | ----------------------------------- |
| Display (h1, h2) | Copernicus, "Tiempos Headline", "EB Garamond", serif | weight 400, letter-spacing negativo |
| UI / Body        | StyreneB, Inter, sans-serif                          | weight 400 body / 500 labels        |
| Código / Mono    | "JetBrains Mono", ui-monospace                       | —                                   |

### Border radius

| Token | Valor  | Uso                            |
| ----- | ------ | ------------------------------ |
| xs    | 4px    | Badges, dropdowns pequeños     |
| sm    | 6px    | Botones inline, items dropdown |
| md    | 8px    | Botones CTA, inputs, tabs      |
| lg    | 12px   | Cards de contenido             |
| xl    | 16px   | Cards hero, modales            |
| pill  | 9999px | Badges pill, tags de estado    |

### Componentes UI clave

| Componente        | Clase base Tailwind                                                |
| ----------------- | ------------------------------------------------------------------ |
| `ButtonPrimary`   | `bg-coral text-white rounded-md px-5 py-3 text-sm font-medium`     |
| `ButtonSecondary` | `bg-canvas text-ink border border-hairline rounded-md`             |
| `ButtonDanger`    | `bg-error text-white rounded-md`                                   |
| `TextInput`       | `bg-canvas border border-hairline rounded-md px-3.5 py-2.5 h-10`   |
| `Card`            | `bg-surface-card rounded-lg p-8`                                   |
| `CardDark`        | `bg-surface-dark text-on-dark rounded-lg`                          |
| `StatusBadge`     | Pills con color semántico por estado                               |
| `SeverityTag`     | `BAJA`=teal · `MEDIA`=amber · `ALTA`=error light · `CRITICA`=error |

### Semáforo de QEs

```typescript
// utils/semaforo.ts
function getSemaforoColor(
  diasRestantes: number,
): "green" | "yellow" | "red" | "critical" {
  if (diasRestantes > 5) return "green";
  if (diasRestantes >= 1) return "yellow";
  return "red"; // diasRestantes < 1; 'critical' para QE severidad CRITICA
}
```

---

## Páginas de referencia visual (dev-only, no producción)

Rutas bajo `/dev/*` son páginas de previsualización del design system para componentes reutilizables que aún no tienen un consumidor real en producción (p.ej. mientras se construyen specs intermedias de un módulo). Convenciones:

- Viven en `src/pages/dev/[Nombre]Page.tsx`.
- Se registran directo en `router/index.tsx` como hijas de `<AppShell>`, fuera de cualquier `<RoleGuard requiredRoles={...}>` — solo requieren sesión autenticada (heredado del `RoleGuard` raíz sin roles). Nunca se agregan a `Sidebar.tsx` ni a la matriz RBAC de un módulo.
- Solo se navegan escribiendo la URL directamente; no son parte de ningún flujo de usuario.
- Texto de la página puede ser literal (sin `t()`) ya que no es UI de producción — no aplica el criterio de aceptación de i18n.

| Ruta                       | Componentes previsualizados                       | Motivo                                                              |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `/dev/semaforo-preview`     | `SemaforoRow` (standalone, fuera del contexto de `ACsPorVencerWidget`) | `SemaforoRow` aislado sigue sin una página de producción propia que lo previsualice. `SemaforoCriticoBanner` ya NO depende de esta página: desde M5-S05a tiene consumidor real en `ACsPorVencerWidget` (`features/dashboard/components/ACsPorVencerWidget.tsx`), usado por `JefeCalidadDashboard` en `/dashboard` para `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`. |

**Mantenimiento:** al agregar nuevos componentes reutilizables de dashboard en specs futuras (M5-S05b en adelante) que aún no tengan una página real que los consuma, o al finalmente construir esa página real, actualizar esta tabla y la página de preview correspondiente (agregar el componente nuevo, o eliminar la ruta dev si ya quedó cubierta por producción).

---

## Autenticación y Roles

### Flujo JWT

```
POST /auth/login → { accessToken, refreshToken (httpOnly cookie) }
  → Axios interceptor añade: Authorization: Bearer <accessToken>
  → Token expirado → interceptor llama POST /auth/refresh automáticamente
  → accessToken en Zustand (memoria), refreshToken en httpOnly cookie
  → Logout: limpiar store + POST /auth/logout
```

**Importante — el interceptor de Axios lee el token del store en cada request, nunca `axios.defaults.headers.common`.** Además, nunca debe adjuntar el `accessToken` a los endpoints públicos de auth (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`): si una sesión anterior sigue en memoria (p.ej. el usuario nunca hizo logout y navega directo a `/login`), un login nuevo NUNCA debe llevar el token de la sesión anterior. `LoginPage` redirige a un usuario ya autenticado en vez de dejarlo re-loguearse encima de una sesión viva.

**Nota técnica — limitación de MSW con cookies httpOnly en el navegador:** MSW en modo Service Worker intercepta `fetch()` con una `Response` sintética; el navegador NO aplica el header `Set-Cookie` de esa respuesta sintética a la cookie jar real (limitación conocida de MSW — solo funciona de forma confiable con `msw/node`, que intercepta a nivel de módulo de red). Como aún no existe backend real, el refresh token del mock se persiste en `localStorage` (`src/lib/mockSession.ts`, clave `shac_mock_refresh_token`) y se envía explícitamente como header `X-Mock-Refresh-Token` en `/api/auth/refresh`, en vez de depender de una cookie. Este mecanismo queda inerte automáticamente ante un backend real sin necesitar una bandera de entorno: solo los handlers MSW devuelven el campo `mockRefreshToken` en el body; un backend .NET real nunca lo hará, así que `localStorage` nunca se llena. **El backend .NET real DEBE usar una cookie `httpOnly` verdadera** (ya está configurado `withCredentials: true` en `lib/axios.ts`) — nunca adaptar el backend real para devolver el refresh token en el body ni leerlo de `localStorage`.

### Roles RBAC

```typescript
type UserRole =
  | "OPERARIO"
  | "SUPERVISOR"
  | "JEFE_CALIDAD_SYST"
  | "JEFE_CONTROL_DOCUMENTARIO"
  | "AUDITOR_INTERNO"
  | "ALTA_DIRECCION"
  | "ADMINISTRADOR_SISTEMA";

interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: UserRole;
  area?: string; // Departamento/área propia del usuario (home area)
  areasAsignadas?: string[]; // Solo relevante para rol === 'SUPERVISOR'. Subconjunto de AREAS_SHAC: áreas que este Supervisor gestiona para efectos de permisos (p.ej. RN-QE-010). Un Supervisor puede tener más de un área asignada. Vacío o ausente para otros roles.
  avatarUrl?: string;
}

`ADMINISTRADOR_SISTEMA` es un rol de sistema puro. Su alcance es EXCLUSIVAMENTE:
- M6 (Admin CRUD Locales/Zonas)
- Futuros módulos de administración de sistema

`ADMINISTRADOR_SISTEMA` NO tiene acceso a ningún módulo operativo (M1 Control Documentario, M2 No Conformidades, M3 Incidentes, M4 Quality Events, M5 KPIs/Dashboard).

La matriz RACI oficial de M1 (SHAC-M1-Matriz-Responsabilidades-v1.0.docx) define únicamente 6 roles y ADMINISTRADOR_SISTEMA no es uno de ellos — cualquier guard de ruta o item de sidebar que le otorgue acceso a M1 (u otro módulo operativo) es un bug, no una excepción.
```

**Importante:** `areasAsignadas` es distinto de `area`. `area` es el departamento propio del usuario; `areasAsignadas` es la lista de áreas que un Supervisor supervisa para efectos de reglas de negocio (p.ej. quién puede editar un QE recién reportado). Cualquier regla que necesite saber "¿este Supervisor gestiona el área X?" debe verificar `areasAsignadas.includes(area)`, nunca comparar contra `area` directamente.

**Nota técnica (M6-S01):** al agregar un rol nuevo al enum UserRole, revisar TODOS los switch exhaustivos sobre rol/UserRole en el código (incidentPermissions.ts, ncPermissions.ts, qualityEventPermissions.ts, documents/permissions.ts) y agregar explícitamente el caso "deny-all" para el rol nuevo en cada dominio que no le corresponda — no confiar en un `default` genérico que oculte roles faltantes.

**Nota técnica adicional (auditoría de rutas, M6-S01):** se detectó que algunas rutas del router (/nonconformities, /nonconformities/:id) carecían de requiredRoles en RoleGuard, permitiendo acceso a cualquier rol autenticado. Al agregar una ruta nueva, SIEMPRE definir requiredRoles explícitamente basado en el helper de permisos del dominio correspondiente — nunca dejarla sin guard por omisión.

### Guards de ruta

- `<RoleGuard requiredRoles={[...]} />` envuelve rutas protegidas.
- Sin rol requerido → redirect `/no-autorizado`.
- Sin autenticación → redirect `/login`.

---

## Internacionalización (i18n)

- Librería: `react-i18next`. Archivos en `src/i18n/es-PE.json` y `src/i18n/en-US.json`.
- Namespaces: `common`, `documents`, `qualityEvents`, `incidents`, `nonconformities`, `dashboard`.
- Fechas: `Intl.DateTimeFormat(locale, options)`. Números: `Intl.NumberFormat(locale)`.

---

## Estado Global — Zustand Stores

```typescript
// authStore.ts
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login(credentials: LoginCredentials): Promise<void>;
  logout(): void;
  refreshToken(): Promise<void>;
}

// uiStore.ts
interface UIStore {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  toggleSidebar(): void;
  setTheme(theme: UIStore["theme"]): void;
}

// preferencesStore.ts — persistido en localStorage
interface PreferencesStore {
  language: "es-PE" | "en-US";
  dateFormat: string;
  setLanguage(lang: string): void;
}
```

---

## API — Axios y TanStack Query

### Instancia base (`lib/axios.ts`)

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json", "Accept-Language": "es-PE" },
  timeout: 30_000,
});
// Interceptor request → añade Bearer token desde authStore
// Interceptor response → maneja 401 con refresh automático
// Interceptor response → extrae data.data de la respuesta estándar
```

### Respuesta estándar del backend

```typescript
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

### Query keys y convención de hooks

```typescript
export const QUERY_KEYS = {
  documents: {
    all: ["documents"] as const,
    list: (filters: DocFilters) => ["documents", "list", filters] as const,
    detail: (id: string) => ["documents", "detail", id] as const,
  },
} as const;

// Patrón de nombres: use[Entidad][Acción]
// useDocuments()            → lista
// useDocument(id)           → detalle
// useCreateDocument()       → mutation crear
// useUpdateDocumentStatus() → mutation cambio de estado
```

---

## Validación con Zod

Los schemas viven en `src/features/[modulo]/schemas/[accion].schema.ts`:

```typescript
// features/documents/schemas/createDocument.schema.ts
export const createDocumentSchema = z.object({
  titulo: z.string().min(5).max(200),
  tipo: z.enum(["POL", "PRC", "INS", "REG", "INF", "MAT", "PLAN"]),
  area: z.string().min(1),
  revisorId: z.string().uuid(),
  aprobadorId: z.string().uuid(),
  descripcion: z.string().max(2000).optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
```

---

## Audit Trail

```typescript
interface AuditTrailEntry {
  id: string;
  entidadTipo: "QualityEvent" | "Documento" | "AccionCorrectiva";
  entidadId: string;
  accion: string; // 'ESTADO_CAMBIADO' | 'CAMPO_EDITADO' | 'FIRMA_REGISTRADA'
  estadoAnterior?: string;
  estadoNuevo?: string;
  campoModificado?: string;
  valorAnterior?: string;
  valorNuevo?: string;
  realizadoPorId: string;
  realizadoPorNombre: string;
  timestamp: string; // ISO 8601 UTC
  ipOrigen?: string;
  generadoPorIA: boolean;
}
```

**Invariante:** Audit trail es append-only. La UI nunca ofrece editar ni eliminar entradas, sin importar el rol.

---

## MSW — Estrategia de Mock

El backend aún no existe. MSW v2 es la única fuente de datos en desarrollo.

### Flujo de datos (tres capas, sin acoplamiento)

```
Componente → Hook TanStack Query → [modulo].api.ts (Axios) → MSW intercepta → JSON ficticio
```

Componentes, hooks y tipos nunca saben si hay backend real o mock.

### Transición a backend real (solo 2 pasos)

1. Eliminar inicialización de MSW en `main.tsx`.
2. Actualizar `VITE_API_BASE_URL` en `.env.production`.

Sin tocar componentes, hooks ni tipos.

### Convenciones de handlers

```typescript
// src/mocks/handlers/[modulo].handlers.ts
import { http, HttpResponse, delay } from "msw";
const LATENCY = 400; // ms

export const documentHandlers = [
  http.get("/api/documents", async ({ request }) => {
    await delay(LATENCY);
    // filtrar, paginar y retornar ApiResponse<T>
  }),
  http.get("/api/documents/:id", async ({ params }) => {
    /* ... */
  }),
  http.post("/api/documents", async ({ request }) => {
    /* ... */
  }),
  http.patch("/api/documents/:id/status", async ({ params, request }) => {
    /* ... */
  }),
  http.delete("/api/documents/:id", async ({ params }) => {
    /* ... */
  }),
];
```

- Latencia simulada: **400ms** en todos los handlers.
- Fixtures en `src/mocks/fixtures/[modulo].fixtures.ts`.
- Todos los handlers exportados y combinados en `src/mocks/handlers/index.ts`.

### Variables de entorno

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:5000
VITE_ENABLE_MSW=true

# .env.production
VITE_API_BASE_URL=https://api.shac.tudominio.com
VITE_ENABLE_MSW=false
```

### Setup en `main.tsx`

```typescript
async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') return;
  const { worker } = await import('./mocks/browser');
  return worker.start({ onUnhandledRequest: 'warn' });
}
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><App /></React.StrictMode>
  );
});
```

---

## Criterios de Aceptación Globales

Un componente o feature está completo cuando:

- [ ] Funciona en Light Mode y Dark Mode sin defectos visuales.
- [ ] Todos los textos visibles usan `t('namespace:clave')` (claves en `es-PE` y `en-US`).
- [ ] Formularios muestran errores de validación Zod localizados.
- [ ] Fechas en formato local del usuario (`Intl.DateTimeFormat`).
- [ ] Mensajes de feedback usan Sonner `toast`, no `alert()`.
- [ ] No hay `useEffect` para derivar estado.
- [ ] No hay `any` en TypeScript.
- [ ] Acciones restringidas por rol no aparecen para usuarios sin permiso.
- [ ] Audit trail registrado en mutaciones de estado.
- [ ] Al menos un test unitario del caso principal.
- [ ] Handler MSW presente para cada endpoint consumido.

## Addendum activo: SHAC-PRD-003-ADD-01

# Archivo: /docs/SHAC-PRD-003-ADD-01.docx

# Tema: Seguridad documental y confidencialidad

# Nuevas reglas: RN-DOC-007 a RN-DOC-012

# Nuevo tipo: DocConfidencialidad (PUBLICO|INTERNO|CONFIDENCIAL|RESTRINGIDO)

# Nuevo campo: Documento.confidencialidad (required)

# Nuevo campo: Documento.rolesAutorizados (conditional)

# Impacto principal: M1-S04 (form), M1-S05 (PDF + seguridad)

## Addendum activo: SHAC-PRD-003-ADD-02

# Archivo: /docs/SHAC-PRD-003-ADD-02.docx

# Tema: Gestión de archivos original editable + PDF distribución

# Nuevas reglas: RN-DOC-013 a RN-DOC-018

# Nuevos campos: archivoOriginalUrl, archivoOriginalNombre,

# archivoOriginalBloqueado, archivoDistribucionUrl

# Impacto principal: M1-S02 (MSW), M1-S04 (form), M1-S05 (congelamiento)

# Regla clave: archivoOriginalUrl solo accesible en BORRADOR/EN_REVISION

# para Autor y JEFE_CONTROL_DOCUMENTARIO (RN-DOC-013)
