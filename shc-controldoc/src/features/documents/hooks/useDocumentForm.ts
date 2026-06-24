import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { documentFormSchema, type DocumentFormInput } from '../schemas/documentForm.schema'
import { useDocument } from './useDocuments'
import { QUERY_KEYS } from '../constants'
import api from '../../../lib/axios'
import type { Documento } from '../../../types/documents.types'

interface UseDocumentFormOptions {
  mode: 'create' | 'edit'
  documentId?: string
}

const CREATE_DEFAULTS: DocumentFormInput = {
  titulo: '',
  tipo: 'PRC',
  area: '',
  version: 'v1.0',
  confidencialidad: 'INTERNO',
  rolesAutorizados: [],
  revisorId: '',
  aprobadorId: '',
  fechaVigencia: '',
  fechaRevisionProxima: '',
  descripcion: '',
  archivo: null,
}

function docToFormValues(doc: Documento): DocumentFormInput {
  return {
    titulo: doc.titulo,
    tipo: doc.tipo,
    area: doc.area,
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
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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
  })

  const { watch, setValue, reset, getValues, formState } = form
  const { isDirty } = formState
  const fechaVigencia = watch('fechaVigencia')
  const confidencialidad = watch('confidencialidad')
  const fechaRevisionAutoFilled = useRef(false)

  // Pre-populate edit mode on initial load; skip if user has already started editing
  useEffect(() => {
    if (mode === 'edit' && documento && !isDirty) {
      reset(docToFormValues(documento))
    }
  }, [mode, documento, reset, isDirty])

  // Auto-fill fechaRevisionProxima when fechaVigencia changes
  useEffect(() => {
    if (fechaVigencia) {
      if (!getValues('fechaRevisionProxima')) {
        setValue('fechaRevisionProxima', addDays(fechaVigencia, 365))
        fechaRevisionAutoFilled.current = true
      }
    } else if (fechaRevisionAutoFilled.current) {
      setValue('fechaRevisionProxima', '')
      fechaRevisionAutoFilled.current = false
    }
  }, [fechaVigencia, setValue, getValues])

  // Clear rolesAutorizados when confidencialidad changes away from RESTRINGIDO
  useEffect(() => {
    if (confidencialidad !== 'RESTRINGIDO') {
      setValue('rolesAutorizados', [])
    }
  }, [confidencialidad, setValue])

  async function onSubmit(data: DocumentFormInput) {
    setIsSubmitting(true)
    try {
      // Auto-fill fechaRevisionProxima if still empty
      if (data.fechaVigencia && !data.fechaRevisionProxima) {
        data.fechaRevisionProxima = addDays(data.fechaVigencia, 365)
      }

      const payload = {
        ...data,
        revisorId: data.revisorId || undefined,
        aprobadorId: data.aprobadorId || undefined,
        archivo: undefined,
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
