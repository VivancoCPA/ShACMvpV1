import { toast } from 'sonner'
import { getDocumentDownloadUrl, registerDocumentAccess } from '../api/endpoints/documents.api'
import { canAccessDocument } from '../features/documents/permissions'
import type { Documento } from '../types/documents.types'
import type { User } from '../types/auth.types'

function limaTimestamp(): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date())
}

function buildPdfHtml(documento: Documento, user: User): string {
  const timestamp = limaTimestamp()
  const isObsoleto = documento.estado === 'OBSOLETO'

  // TODO: server-side PDF con marca de agua real y permisos restrictivos (RN-DOC-010)
  // implementar cuando exista el backend .NET — actualmente es HTML mock.
  // CA-20: deshabilitar copia de texto se implementa server-side.
  // CA-24: restricción de impresión se implementa server-side.

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${documento.codigo} — ${documento.titulo}</title>
  <style>
    body { font-family: sans-serif; margin: 40px; color: #141413; }
    .watermark {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 48px; color: rgba(0,0,0,0.07); white-space: nowrap; pointer-events: none;
      user-select: none;
    }
    .obsolete-banner {
      background: #fde8e8; border: 2px solid #c64545; color: #c64545;
      padding: 16px; text-align: center; font-size: 24px; font-weight: bold;
      margin-bottom: 24px;
    }
    .header { border-bottom: 2px solid #e6dfd8; padding-bottom: 16px; margin-bottom: 24px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
    .meta dt { font-weight: 600; color: #6c6a64; font-size: 12px; text-transform: uppercase; }
    .meta dd { margin: 0; font-size: 14px; }
    .copy-notice {
      margin-top: 40px; padding: 12px; background: #f5f0e8;
      border: 1px solid #e6dfd8; font-size: 12px; color: #6c6a64;
    }
    .user-watermark { font-weight: bold; color: #cc785c; }
  </style>
</head>
<body>
  <div class="watermark">COPIA NO CONTROLADA</div>
  ${isObsoleto ? '<div class="obsolete-banner">OBSOLETO — No usar</div>' : ''}
  <div class="header">
    <h1>${documento.codigo} — ${documento.titulo}</h1>
    <p>Versión ${documento.version} · Estado: ${documento.estado}</p>
  </div>
  <dl class="meta">
    <dt>Área</dt><dd>${documento.areaId}</dd>
    <dt>Tipo</dt><dd>${documento.tipo}</dd>
    <dt>Fecha de emisión</dt><dd>${documento.fechaEmision ?? '—'}</dd>
    <dt>Fecha de vigencia</dt><dd>${documento.fechaVigencia ?? '—'}</dd>
  </dl>
  <div class="copy-notice">
    <p class="user-watermark">Descargado por: ${user.nombre} ${user.apellido}</p>
    <p>Fecha y hora Lima: ${timestamp}</p>
    <p><strong>COPIA NO CONTROLADA — Solo válido al momento de impresión</strong></p>
    <p>Hash: ${documento.hashArchivo ?? 'sin firma'}</p>
  </div>
</body>
</html>`
}

export async function requestDocumentPdf(documento: Documento, user: User): Promise<void> {
  // RN-DOC-011: verificar acceso por confidencialidad
  if (!canAccessDocument(documento.confidencialidad, user.rol, documento.rolesAutorizados ?? [])) {
    toast.error('documents:errors.accessDenied')
    return
  }

  // Paso 1 — Solicitar URL firmada (RN-DOC-009)
  let downloadData: { url: string; expiresAt: string }
  try {
    downloadData = await getDocumentDownloadUrl(documento.id)
  } catch {
    toast.error('documents:errors.downloadUrlExpired')
    return
  }

  if (!downloadData?.url) {
    toast.error('documents:errors.downloadUrlExpired')
    return
  }

  // Paso 2 — Registrar DESCARGA en auditTrail (RN-DOC-008)
  await registerDocumentAccess(documento.id, {
    accion: 'DESCARGA',
    timestamp: new Date().toISOString(),
  })

  // Paso 3 — Abrir ventana con PDF mock + marca de agua (RN-DOC-007)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(buildPdfHtml(documento, user))
    win.document.close()
  }
}

export async function requestDocumentView(documento: Documento, user: User): Promise<void> {
  // RN-DOC-011: verificar acceso por confidencialidad
  if (!canAccessDocument(documento.confidencialidad, user.rol, documento.rolesAutorizados ?? [])) {
    toast.error('documents:errors.accessDenied')
    return
  }

  // Solicitar URL firmada (RN-DOC-009)
  try {
    await getDocumentDownloadUrl(documento.id)
  } catch {
    toast.error('documents:errors.downloadUrlExpired')
    return
  }

  // Registrar VISUALIZACION en auditTrail (RN-DOC-008)
  await registerDocumentAccess(documento.id, {
    accion: 'VISUALIZACION',
    timestamp: new Date().toISOString(),
  })

  if (documento.archivoUrl) {
    window.open(documento.archivoUrl, '_blank')
  }
}
