import { http, HttpResponse, delay } from 'msw'
import { localFixtures, zonaFixtures } from '../fixtures/locales.fixtures'

const LATENCY = 400

export const localesHandlers = [
  http.get('/api/locales', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const activo = url.searchParams.get('activo')

    const result = activo !== null
      ? localFixtures.filter((l) => l.activo === (activo === 'true'))
      : localFixtures

    return HttpResponse.json({ success: true, data: result })
  }),

  http.get('/api/zonas', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const localId = url.searchParams.get('localId')

    const result = localId !== null
      ? zonaFixtures.filter((z) => z.localId === localId)
      : zonaFixtures

    return HttpResponse.json({ success: true, data: result })
  }),
]
