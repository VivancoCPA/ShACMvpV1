import { resetStore as resetDocumentsStore } from './handlers/documents.handlers'
import { resetStore as resetQualityEventsStore } from './handlers/quality-events.handlers'
import { resetStore as resetNonconformitiesStore } from './handlers/nonconformities.handlers'
import { resetStore as resetIncidentsStore } from './handlers/incidents.handlers'
import { resetStore as resetLocalesStore } from './handlers/locales.handlers'
import { resetStore as resetNotificationsStore } from './handlers/notifications.handlers'
import { resetStore as resetAreasStore } from './handlers/areas.handlers'

// Dominios cubiertos hoy: documents, quality-events, nonconformities, incidents,
// locales (locales+zonas), notifications, areas. Al agregar un store mutable nuevo en
// otro dominio, exportar su propio `resetStore()` (ver documents.handlers.ts
// como referencia) y registrarlo aquí — de lo contrario ese dominio no se
// reiniciará desde /dev/reset-mocks. No incluye `authFixtures`/usuarios (fuera
// de alcance, ver openspec/changes/reset-dev-only/design.md).
export function resetAllMockStores(): void {
  resetDocumentsStore()
  resetQualityEventsStore()
  resetNonconformitiesStore()
  resetIncidentsStore()
  resetLocalesStore()
  resetNotificationsStore()
  resetAreasStore()
}
