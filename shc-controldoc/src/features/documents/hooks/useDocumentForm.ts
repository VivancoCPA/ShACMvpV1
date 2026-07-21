import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { addMonths } from 'date-fns'
import { documentFormSchema, type DocumentFormInput } from '../schemas/documentForm.schema'
import { useDocument } from './useDocuments'
import { QUERY_KEYS } from '../constants'
import api from '../../../lib/axios'
import type { Documento } from '../../../types/documents.types'
import { DOC_PERIODICIDAD_POR_TIPO } from '../../../config/businessRules.config'

interface UseDocumentFormOptions {
  mode: 'create' | 'edit'
  documentId?: string
}

const CREATE_DEFAULTS: DocumentFormInput = {
  titulo: '',
  tipo: 'PRC',
  areaId: '',
  version: 'v1.0',
  confidencialidad: 'INTERNO',
  rolesAutorizados: [],
  revisorId: '',
  aprobadorId: '',
  fechaVigencia: '',
  fechaRevisionProxima: '',
  descripcion: '',
  archivo: null,
  archivoOriginalFile: null,
  archivoOriginalUrl: null,
  archivoDistribucionUrl: null,
}

function docToFormValues(doc: Documento): DocumentFormInput {
  return {
    titulo: doc.titulo,
    tipo: doc.tipo,
    areaId: doc.areaId,
    version: doc.version,
    confidencialidad: doc.confidencialidad,
    rolesAutorizados: doc.rolesAutorizados ?? [],
    revisorId: doc.revisorId ?? '',
    aprobadorId: doc.aprobadorId ?? '',
    fechaVigencia: doc.fechaVigencia ? doc.fechaVigencia.slice(0, 10) : '',
    fechaRevisionProxima: doc.fechaRevisionProxima
      ? doc.fechaRevisionProxima.slice(0, 10)
      : '',
    descripcion: doc.descripcion ?? '',
    archivo: null,
    archivoOriginalFile: null,
    archivoOriginalUrl: doc.archivoOriginalUrl ?? null,
    archivoDistribucionUrl: doc.archivoDistribucionUrl ?? null,
  }
}

function addMonthsIso(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return addMonths(new Date(Date.UTC(y, m - 1, d)), months).toISOString().slice(0, 10)
}

export function useDocumentForm({ mode, documentId }: UseDocumentFormOptions) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: documento, isLoading: isDocLoading } = useDocument(
    mode === 'edit' ? (documentId ?? '') : '',
  )

  const form = useForm<DocumentFormInput>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: CREATE_DEFAULTS,
    values: mode === 'edit' && documento ? docToFormValues(documento) : undefined,
  })

  const { watch, setValue, formState } = form
  const fechaVigencia = watch('fechaVigencia')
  const tipo = watch('tipo')
  const confidencialidad = watch('confidencialidad')
  const fechaRevisionProximaTouched = formState.touchedFields.fechaRevisionProxima

  // Sugiere fechaRevisionProxima según la periodicidad del tipo (RN-DOC-020) mientras
  // el usuario no haya tocado el campo. Solo en creación: en edición no debe
  // sobreescribir una fecha ya guardada al cargar el documento.
  useEffect(() => {
    if (mode !== 'create' || fechaRevisionProximaTouched) return

    const meses = DOC_PERIODICIDAD_POR_TIPO[tipo]
    if (fechaVigencia && meses) {
      setValue('fechaRevisionProxima', addMonthsIso(fechaVigencia, meses))
    } else {
      setValue('fechaRevisionProxima', '')
    }
  }, [mode, fechaVigencia, tipo, fechaRevisionProximaTouched, setValue])

  // Clear rolesAutorizados when confidencialidad changes away from RESTRINGIDO
  useEffect(() => {
    if (confidencialidad !== 'RESTRINGIDO') {
      setValue('rolesAutorizados', [])
    }
  }, [confidencialidad, setValue])

  async function onSubmit(data: DocumentFormInput) {
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        revisorId: data.revisorId || undefined,
        aprobadorId: data.aprobadorId || undefined,
        archivo: undefined,
        archivoOriginalFile: undefined,
        archivoOriginalUrl: undefined,
        archivoDistribucionUrl: undefined,
      }

      if (mode === 'create') {
        const response = await api.post<Documento>('/api/documents', payload)
        const created = response.data

        if (data.archivo) {
          const formData = new FormData()
          formData.append('archivo', data.archivo)
          await api.post(`/api/documents/${created.id}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }

        if (data.archivoOriginalFile) {
          const formData = new FormData()
          formData.append('archivoOriginal', data.archivoOriginalFile)
          await api.post(`/api/documents/${created.id}/archivo-original`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }

        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
        toast.success(t('form.success_create'))
        navigate('/documents')
      } else {
        await api.put<Documento>(`/api/documents/${documentId}`, payload)

        if (data.archivo) {
          const formData = new FormData()
          formData.append('archivo', data.archivo)
          await api.post(`/api/documents/${documentId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }

        if (data.archivoOriginalFile) {
          const formData = new FormData()
          formData.append('archivoOriginal', data.archivoOriginalFile)
          await api.post(`/api/documents/${documentId}/archivo-original`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }

        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
        if (documentId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
        }
        toast.success(t('form.success_edit'))
        navigate('/documents')
      }
    } catch (error) {
      const serverMsg =
        isAxiosError(error) && error.response?.status === 409
          ? (error.response.data as { message?: string } | null)?.message
          : null
      toast.error(serverMsg ?? t('form.error_submit'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    form,
    documento,
    isDocLoading,
    isSubmitting,
    onSubmit: form.handleSubmit(onSubmit),
  }
}
