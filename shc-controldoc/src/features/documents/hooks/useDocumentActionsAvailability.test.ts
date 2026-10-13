// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { useDocumentActionsAvailability } from './useDocumentActionsAvailability'
import type { Documento } from '../../../types/documents.types'

// Extracción 1:1 (detalle-documento-dos-columnas, D6) de la disponibilidad de acciones que
// antes se calculaba inline en DocumentActionPanel — estos casos portan los mismos escenarios
// de estado/rol que ya cubría DocumentActionPanel.test.tsx (33/33 siguen pasando sin tocar este
// hook, ver ese archivo), verificando directamente cada bandera en vez de a través del DOM.

function makeDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'EN_REVISION',
    areaId: 'Calidad',
    empresaId: 'empresa-001',
    confidencialidad: 'INTERNO',
    autorId: 'user-autor-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    ncVinculados: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderAvailability(documento: Documento) {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return renderHook(() => useDocumentActionsAvailability(documento), { wrapper })
}

afterEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

describe('useDocumentActionsAvailability', () => {
  it('sin sesión, todas las banderas son false/undefined', () => {
    const documento = makeDocumento({ estado: 'PUBLICADO' })
    const { result } = renderAvailability(documento)

    expect(result.current.hasAnyAction).toBe(false)
    expect(result.current.canVerDocumento).toBe(false)
    expect(result.current.canDescargarCopia).toBe(false)
  })

  it('EN_REVISION: solo el revisor asignado puede aprobar/rechazar, no cualquier JEFE_CALIDAD', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION', revisorId: 'user-revisor-001' })

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jefecalidad-999', rol: 'JEFE_CALIDAD_SYST' } as never })
    const otroJefe = renderAvailability(documento)
    expect(otroJefe.result.current.canApproveReview).toBe(false)
    expect(otroJefe.result.current.canRejectReview).toBe(false)

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-revisor-001', rol: 'JEFE_CALIDAD_SYST' } as never })
    const elRevisor = renderAvailability(documento)
    expect(elRevisor.result.current.canApproveReview).toBe(true)
    expect(elRevisor.result.current.canRejectReview).toBe(true)
  })

  it('EN_APROBACION: solo el aprobador asignado puede firmar/rechazar', () => {
    const documento = makeDocumento({ estado: 'EN_APROBACION', aprobadorId: 'user-aprobador-001' })

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jefecalidad-999', rol: 'JEFE_CALIDAD_SYST' } as never })
    const otroJefe = renderAvailability(documento)
    expect(otroJefe.result.current.canSign).toBe(false)
    expect(otroJefe.result.current.canRejectAprobacion).toBe(false)

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-aprobador-001', rol: 'JEFE_CALIDAD_SYST' } as never })
    const elAprobador = renderAvailability(documento)
    expect(elAprobador.result.current.canSign).toBe(true)
    expect(elAprobador.result.current.canRejectAprobacion).toBe(true)
  })

  it('BORRADOR sin revisor/aprobador asignado: canSendToReview es false, el bloqueado es true', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', autorId: 'user-autor-001', revisorId: undefined, aprobadorId: undefined })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'SUPERVISOR' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.faltaAsignacion).toBe(true)
    expect(result.current.canSendToReview).toBe(false)
    expect(result.current.canSendToReviewBloqueadoPorAsignacion).toBe(true)
  })

  it('BORRADOR con revisor y aprobador asignados: el autor puede enviar a revisión', () => {
    const documento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      revisorId: 'user-revisor-001',
      aprobadorId: 'user-aprobador-001',
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'SUPERVISOR' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.faltaAsignacion).toBe(false)
    expect(result.current.canSendToReview).toBe(true)
    expect(result.current.canSendToReviewBloqueadoPorAsignacion).toBe(false)
  })

  it('PUBLICADO: canVerDocumento y canDescargarCopia son true con acceso de confidencialidad', () => {
    const documento = makeDocumento({ estado: 'PUBLICADO', confidencialidad: 'PUBLICO' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-operario-001', rol: 'OPERARIO' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canVerDocumento).toBe(true)
    expect(result.current.canDescargarCopia).toBe(true)
  })

  it('CONFIDENCIAL bloquea a OPERARIO: ni ver ni descargar', () => {
    const documento = makeDocumento({ estado: 'PUBLICADO', confidencialidad: 'CONFIDENCIAL' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-operario-001', rol: 'OPERARIO' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canVerDocumento).toBe(false)
    expect(result.current.canDescargarCopia).toBe(false)
  })

  it('OBSOLETO: JEFE_CONTROL_DOCUMENTARIO ve el documento vía la excepción CA-34 aunque no tenga canRead por la matriz', () => {
    const documento = makeDocumento({ estado: 'OBSOLETO', confidencialidad: 'PUBLICO' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jefedocs-001', rol: 'JEFE_CONTROL_DOCUMENTARIO' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canVerDocumento).toBe(true)
    // OBSOLETO nunca tiene descarga (RN-DOC-003), ni siquiera con la excepción CA-34.
    expect(result.current.canDescargarCopia).toBe(false)
  })

  it('PUBLICADO: canStartPeriodic por rol global, independiente de ser autor/revisor/aprobador', () => {
    const documento = makeDocumento({ estado: 'PUBLICADO', autorId: 'user-autor-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'JEFE_CALIDAD_SYST' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canStartPeriodic).toBe(true)
  })

  it('PUBLICADO: canCreateVersion para el autor del origen o JCA/JCD, no para un operario cualquiera', async () => {
    const documento = makeDocumento({ estado: 'PUBLICADO', autorId: 'user-autor-001' })

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'SUPERVISOR' } as never })
    const { result } = renderAvailability(documento)
    await waitFor(() => expect(result.current.canCreateVersion).toBe(true))

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-operario-001', rol: 'OPERARIO' } as never })
    const otro = renderAvailability(documento)
    expect(otro.result.current.canCreateVersion).toBe(false)
  })

  it('BORRADOR: canDelete solo cuando getDocumentPermissions lo permite (autor en BORRADOR)', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', autorId: 'user-autor-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'SUPERVISOR' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canDelete).toBe(true)
  })

  it('documento eliminado: isDeleted true y ninguna otra acción disponible, aunque el estado permitiría alguna', () => {
    // Regresión: antes de la extracción, DocumentActionPanel cortaba con un `return` anticipado
    // apenas veía `documento.deletedAt`, sin llegar a calcular canVerDocumento/canDescargarCopia/etc.
    // El hook debe replicar ese corte, no solo heredar isDeleted sin apagar el resto.
    const documento = makeDocumento({
      estado: 'PUBLICADO',
      confidencialidad: 'PUBLICO',
      deletedAt: '2026-01-05T10:00:00.000Z',
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jefecalidad-001', rol: 'JEFE_CALIDAD_SYST' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.isDeleted).toBe(true)
    expect(result.current.canVerDocumento).toBe(false)
    expect(result.current.canDescargarCopia).toBe(false)
    expect(result.current.canStartPeriodic).toBe(false)
    expect(result.current.hasAnyAction).toBe(false)
  })

  it('documento eliminado: canRestore solo para JEFE_CALIDAD_SYST/ALTA_DIRECCION', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', deletedAt: '2026-01-05T10:00:00.000Z' })

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'SUPERVISOR' } as never })
    expect(renderAvailability(documento).result.current.canRestore).toBe(false)

    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-x', rol: 'ALTA_DIRECCION' } as never })
    expect(renderAvailability(documento).result.current.canRestore).toBe(true)
  })

  it('BORRADOR: JEFE_CALIDAD_SYST que es el revisor asignado de ESTE documento no ve enviar/eliminar (precedencia de docRole)', () => {
    // nueva-version-autor-permisos: un JCA/JCD asignado como revisor/aprobador de este documento
    // resuelve a docRole REVISOR/APROBADOR (solo lectura en BORRADOR) — nunca al flag global
    // "isJefeCalidad" suelto, que antes dejaba editar/eliminar un BORRADOR ajeno sin ser su autor.
    const documento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      revisorId: 'user-jca-001',
      aprobadorId: 'user-aprobador-001',
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jca-001', rol: 'JEFE_CALIDAD_SYST' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canSendToReview).toBe(false)
    expect(result.current.canDelete).toBe(false)
  })

  it('BORRADOR: JEFE_CALIDAD_SYST que NO es revisor/aprobador de este documento sí ve enviar/eliminar', () => {
    const documento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      revisorId: 'user-revisor-001',
      aprobadorId: 'user-aprobador-001',
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jca-ajeno', rol: 'JEFE_CALIDAD_SYST' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.canSendToReview).toBe(true)
    expect(result.current.canDelete).toBe(true)
  })

  it('hasAnyAction es false cuando ninguna acción individual está disponible', () => {
    // OBSOLETO + rol sin ninguna excepción ni acceso de confidencialidad especial.
    const documento = makeDocumento({ estado: 'OBSOLETO', confidencialidad: 'CONFIDENCIAL' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-operario-001', rol: 'OPERARIO' } as never })

    const { result } = renderAvailability(documento)

    expect(result.current.hasAnyAction).toBe(false)
  })
})
