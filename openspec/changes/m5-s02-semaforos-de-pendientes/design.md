## Context

M5-S01 dejó tipos, RBAC, fixtures y hooks del Dashboard listos, pero sin ninguna pieza de UI. `AGENTS.md` no existe en el repo (confirmado también en M5-S01); el contexto funcional para este spec viene íntegramente del prompt del usuario, que cita "PRD sección 5.3" y un mockup interactivo ya aprobado — ninguno de los dos es un archivo accesible en este repo, así que las reglas de color/umbral que siguen son una transcripción de esa conversación, no una fuente verificable en `openspec/`.

El repo ya tiene dos precedentes de "semáforo de plazo" con reglas y lenguaje visual **distintos**, que este spec no debe confundir con el nuevo componente:
- `RevisionSemaforo` (`features/documents/components/RevisionSemaforo.tsx`): puntos de color + tooltip, basado en **días calendario** (`differenceInCalendarDays`), para la revisión periódica de documentos (RN-DOC-006).
- `DeadlineBadge` (`components/shared/DeadlineBadge.tsx`, capability `deadline-badge`): pill de fondo coloreado, también en **días calendario**, con umbrales 14/0 días, usado en NCList.

El nuevo `SemaforoRow` es intencionalmente distinto de ambos: usa **días hábiles** (no calendario, por pedido explícito del PRD §5.3 y RNG-003), tratamiento de **borde izquierdo** (no punto ni fondo), y un cuarto estado (`CRITICO`) que no es una fila sino un banner separado. No se reutiliza `DeadlineBadge` ni se le agregan variantes — tienen semántica de negocio distinta (plazo de revisión documentaria vs. plazo de cierre de QE/AC) y el mockup ya aprobado descarta explícitamente el tratamiento de fondo coloreado que sí usa `DeadlineBadge`.

`contarDiasHabiles` ya existe en `features/quality-events/utils/qualityEventHelpers.ts`, usado por `estaVencidaVerificacion` (RN-QE-008, ventana de 10 días hábiles) y por `QEHeaderSection`. Solo cuenta lunes-viernes; no soporta feriados. RNG-003 (citado en el pedido) exige feriados configurables, así que no se puede reusar tal cual sin extenderlo.

## Goals / Non-Goals

**Goals:**
- Una utilidad de días hábiles reusable y sin acoplar a QE (`src/utils/businessDays.ts`), con feriados opcionales, que reemplace la implementación duplicada de `qualityEventHelpers.ts` sin romper su contrato público.
- Un cálculo de estado semáforo de fila (`VERDE`/`AMARILLO`/`ROJO`) puro y testeable, separado de los componentes visuales.
- `SemaforoRow` y `SemaforoCriticoBanner` como componentes de presentación puros (reciben props ya calculadas, no conocen `QualityEvent` ni `AccionCorrectiva`) para que cualquier dashboard (QE, AC, o un futuro dominio) los consuma sin acoplarse a un tipo de dominio específico.
- Soporte light/dark con los tokens Tailwind ya definidos en `tailwind.config.ts` (`success`, `warning`, `error`, `surface-card`, `surface-dark-elevated`, `hairline`) — no se introducen colores nuevos ni variables CSS custom.

**Non-Goals:**
- No se construye ningún dashboard consumidor (S03-S07) ni se decide cómo cada uno arma la lista de items críticos — el filtrado "¿qué QE/AC es crítico?" es responsabilidad de cada dashboard consumidor, que ya tiene acceso a `severidad`/`estado` vía los tipos de M5-S01.
- No se agrega un store, fixture ni endpoint de feriados. `feriados` es un parámetro opcional (`string[]`, formato `'yyyy-MM-dd'`) que este spec deja vacío por defecto; poblarlo con el calendario real de feriados peruanos es una decisión de negocio fuera de alcance (ver Open Questions).
- No se toca `DeadlineBadge` ni `RevisionSemaforo` — son componentes de un dominio y umbral distintos, ya en producción.

## Decisions

### 1. `contarDiasHabiles` se mueve a `src/utils/businessDays.ts` y se extiende con feriados opcionales; `qualityEventHelpers.ts` delega
```typescript
// src/utils/businessDays.ts
export function contarDiasHabiles(desde: Date, hasta: Date, feriados: string[] = []): number
export function calcularDiasHabilesRestantes(hoy: Date, fechaVencimiento: Date, feriados: string[] = []): number
```
`contarDiasHabiles` conserva exactamente la semántica actual (cuenta días hábiles estrictamente entre `desde` (exclusivo) y `hasta` (inclusive), asumiendo `hasta >= desde`) y solo añade: excluir fechas presentes en `feriados` (comparadas como `'yyyy-MM-dd'` vía `date-fns#format`). Con `feriados = []` (default), el resultado es idéntico al de hoy — `qualityEventHelpers.ts` pasa a re-exportar la función compartida en vez de mantener su propio bucle, y ni `estaVencidaVerificacion` ni `QEHeaderSection` cambian su forma de llamarla (ningún caller existente pasa `feriados`, así que no hay cambio de comportamiento observable).

`calcularDiasHabilesRestantes` es nueva: a diferencia de `contarDiasHabiles` (siempre no-negativo, asume orden), esta SÍ devuelve signo — positivo si `fechaVencimiento` es futura (días restantes), negativo si ya pasó (días de atraso), usando `contarDiasHabiles` internamente en el orden correcto y negando el resultado cuando `fechaVencimiento < hoy`. Es la que necesita el semáforo de fila, que debe distinguir "vence en 3 días" de "vencido hace 3 días" con el mismo tipo de dato.

**Alternativa considerada**: mantener `contarDiasHabiles` solo en `quality-events` y duplicar una versión con feriados en `features/dashboard/utils/`. Descartada: el pedido explícito es "reutilizar cálculo de días hábiles ya existente en el sistema" — duplicar el bucle de fin de semana en dos features sería el mismo problema que este spec busca evitar en los propios dashboards consumidores.

### 2. Umbral de "0 días restantes" (vence hoy) se trata como `ROJO`, con texto propio
El PRD citado define Verde `>5`, Amarillo `1-5`, Rojo "vencido" — no dice explícitamente en qué bucket cae el día exacto de vencimiento (`0` días hábiles restantes). Se decide: `diasHabilesRestantes <= 0` → `ROJO` (no queda ningún día hábil de margen, es tan urgente como estar vencido). Para no forzar el texto "Vencido hace 0d" (confuso), `SemaforoRow` usa una tercera clave de texto específica para el caso exacto de `0`: `dashboard:semaforo.venceHoy`, distinta de `venceEn` (`>0`) y `vencidoHace` (`<0`). El color (`ROJO` / `text-error`) es el mismo para `0` y negativos — solo cambia el texto.

**Alternativa considerada**: tratar `0` como último día de `AMARILLO`. Descartada: el mockup aprobado y el nombre "Rojo = vencido" sugieren que el día de vencimiento ya debe leerse como urgente máximo, no como advertencia; además es la interpretación más segura para un sistema de calidad/SyST (falso positivo de urgencia es preferible a uno de despreocupación).

### 3. `calcularEstadoSemaforoFila` vive en `features/dashboard/utils/semaforoPendientes.ts`, no en `src/utils/`
```typescript
// src/features/dashboard/utils/semaforoPendientes.ts
export function calcularEstadoSemaforoFila(diasHabilesRestantes: number): SemaforoEstadoFila // 'VERDE' | 'AMARILLO' | 'ROJO'
export function calcularEstadoSemaforoDesdeFecha(
  fechaVencimiento: string | Date,
  hoy?: Date,
  feriados?: string[],
): { estado: SemaforoEstadoFila; diasHabilesRestantes: number }
```
A diferencia de `contarDiasHabiles`/`calcularDiasHabilesRestantes` (genéricas, sin conocimiento de negocio), los umbrales 5/1/0 son una regla de negocio específica del semáforo de pendientes del Dashboard (PRD §5.3), no una utilidad de fechas de propósito general — por eso vive en `features/dashboard/utils/`, no en `src/utils/`, siguiendo la separación ya usada en el repo (`src/utils/` = helpers genéricos; `features/[modulo]/utils/` = reglas de negocio del módulo).

### 4. `SemaforoRow` y `SemaforoCriticoBanner` son componentes de presentación puros, sin conocimiento de dominio
```typescript
// src/components/shared/SemaforoRow.tsx
interface SemaforoRowProps {
  estado: 'VERDE' | 'AMARILLO' | 'ROJO'
  codigo: string
  descripcion: string
  diasHabilesRestantes: number
  onClick?: () => void
}

// src/components/shared/SemaforoCriticoBanner.tsx
interface SemaforoCriticoBannerItem {
  id: string
  codigo: string
  descripcion: string
}
interface SemaforoCriticoBannerProps {
  items: SemaforoCriticoBannerItem[]
  onItemClick?: (id: string) => void
}
```
Ninguno importa `QualityEvent`, `AccionCorrectivaQE` ni tipos de `features/quality-events`. Cada dashboard consumidor (S03-S07) es responsable de mapear su dominio (QE en cualquier estado, AC en `EN_EJECUCION`) a estas props — incluyendo qué cuenta como "crítico sin cerrar" para el banner, que depende de `severidad`/`estado` de QE, algo que este spec no decide porque no construye ningún dashboard. Esto reutiliza el mismo patrón ya usado por `shared-pagination`/`shared-filter-bar`: componentes de `components/shared/` genéricos, con la lógica de dominio en el feature que los consume.

Se colocan en `components/shared/` (no en `features/dashboard/components/`) porque el pedido los describe explícitamente como "componente compartido" reutilizable por 5+ dashboards, igual que `DeadlineBadge`/`Pagination`/`FilterBar` — todos con el mismo patrón de ubicación en este repo.

**Alternativa considerada**: exponer un único componente `SemaforoRow` que reciba `fechaVencimiento` y calcule el estado internamente (fusionando presentación + cálculo). Descartada: acoplaría el componente a `Date`/zona horaria en tiempo de render (dificulta memoización y tests de snapshot con fecha fija) y le impediría a un dashboard mostrar una fila ya pre-calculada desde datos server-side (`KpiResult`-like) sin recalcular en el cliente. Mantener el cálculo (`calcularEstadoSemaforoDesdeFecha`) y la presentación (`SemaforoRow`) separados es más testeable y más barato de adoptar en S03-S07.

### 5. Estilos: borde izquierdo de 3px por rol semántico, sin redondeo en ese lado, sin fondo coloreado
```
Fila: rounded-lg rounded-l-none border border-hairline dark:border-hairline/20
      bg-surface-card dark:bg-surface-dark-elevated
      border-l-[3px] border-l-{success|warning|error} (según estado)
Texto de plazo: text-{success|warning|error} dark:text-{success|warning|error} (mismo token, variante dark explícita por regla del proyecto)
Banner Crítico: bg-error/10 dark:bg-error/15 border border-error dark:border-error rounded-lg
                ícono AlertTriangle (lucide-react, ya usado en el repo) + texto text-error dark:text-error
```
No se introducen tokens Tailwind nuevos — se reutilizan `success`/`warning`/`error`/`surface-card`/`surface-dark-elevated`/`hairline` ya definidos en `tailwind.config.ts`. El pedido original nombra variables tipo `--text-success`/`--surface-1`/`--bg-danger`; este repo no usa CSS custom properties para su sistema de diseño (usa tokens de color de Tailwind, ver `CLAUDE.md`), así que esos nombres se traducen 1:1 a los tokens Tailwind equivalentes ya existentes, no se crean variables CSS nuevas.

### 6. i18n: nuevas claves bajo el namespace `dashboard` (hoy vacío `{}`)
```json
"dashboard": {
  "semaforo": {
    "venceEn": "Vence en {{dias}}d",
    "venceHoy": "Vence hoy",
    "vencidoHace": "Vencido hace {{dias}}d",
    "criticoBanner": {
      "title": "Eventos críticos sin cerrar",
      "count": "{{count}} evento crítico sin cerrar",
      "count_other": "{{count}} eventos críticos sin cerrar"
    }
  }
}
```
El namespace `dashboard` ya está registrado en `src/i18n/index.ts` pero vacío desde M5-S01; este spec es el primero en poblarlo. Se usa el plural de `i18next` (`count_other`) para el banner, siguiendo la convención de interpolación ya usada en `documents:semaforo.diasRestantes`.

## Risks / Trade-offs

- [Los umbrales de color y el caso "0 días" son una transcripción de una conversación, no un PRD verificable en el repo] → Documentado explícitamente aquí y en el proposal; los umbrales viven como literales dentro de `calcularEstadoSemaforoFila` (una función, fácil de ajustar) si el PRD real difiere.
- [`feriados` queda vacío por defecto — el "días hábiles" real hoy es solo "lunes a viernes"] → Aceptable para este spec (RNG-003 solo pide que la función *soporte* feriados configurables, no que el calendario esté poblado); cuando exista una fuente de feriados, se pasa como argumento sin cambiar la firma.
- [Dos componentes de "semáforo" con reglas distintas conviven en el repo (`DeadlineBadge` en días calendario, `SemaforoRow` en días hábiles)] → Riesgo de confusión para futuros desarrolladores; mitigado documentando la distinción aquí y dejando el nombre `SemaforoRow` (no `DeadlineBadge2`) para que no parezca una variante del mismo componente.
- [Componentes puros sin acceso a dominio dejan la lógica de "qué es crítico" sin dueño hasta S03] → Aceptable: es exactamente el corte de alcance pedido ("Fuera de alcance: los dashboards que consumen estos componentes").

## Open Questions

- ¿Cuál es el calendario real de feriados peruanos/de la empresa que debe poblar `feriados`? No resuelto aquí — cuando se defina, se pasa como argumento a `calcularDiasHabilesRestantes`/`calcularEstadoSemaforoDesdeFecha` sin tocar su firma.
- ¿El caso "vence hoy" (0 días hábiles) debe ser `ROJO` con texto propio (decisión de este spec) o el PRD real lo define distinto? Ajustar si aparece el PRD oficial.
