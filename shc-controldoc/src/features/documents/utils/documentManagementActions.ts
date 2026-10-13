import type { TFunction } from 'i18next'
import type { DocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'

export interface ManagementActionItem {
  id: string
  label: string
  onClick: () => void
  variant: 'primary' | 'secondary' | 'danger' | 'success'
  disabled?: boolean
  disabledTitle?: string
}

/**
 * Lista ordenada por prioridad (design.md D7) de las acciones de gestión disponibles para el
 * documento actual — el encabezado muestra como máximo las 2 primeras inline; el resto va al
 * menú "⋯". El orden refleja "el siguiente paso más probable del flujo" primero; no es una
 * regla de negocio, es una decisión de UX de este rediseño (ver design.md).
 */
export function getManagementActionItems(
  availability: DocumentActionsAvailability,
  controller: Pick<DocumentActionsController, 'setModal'>,
  t: TFunction,
): ManagementActionItem[] {
  const tooltipYaExiste = availability.otraVersionEnProceso
    ? t('nuevaVersion.tooltipYaExiste', { estado: t(`common:statuses.${availability.otraVersionEnProceso.estado}`) })
    : undefined

  const items: Array<ManagementActionItem | false> = [
    availability.canSign && {
      id: 'sign',
      label: t('detail.actions.sign'),
      onClick: () => controller.setModal('sign'),
      variant: 'success',
    },
    availability.canApproveReview && {
      id: 'approve',
      label: t('detail.actions.approveReview'),
      onClick: () => controller.setModal('confirm-approve'),
      variant: 'primary',
    },
    (availability.canRejectReview || availability.canRejectAprobacion) && {
      id: 'reject',
      label: t('detail.actions.reject'),
      onClick: () => controller.setModal('reject'),
      variant: 'danger',
    },
    availability.canSendToReview && {
      id: 'send',
      label: t('detail.actions.sendToReview'),
      onClick: () => controller.setModal('confirm-send'),
      variant: 'primary',
    },
    availability.canSendToReviewBloqueadoPorAsignacion && {
      id: 'send-disabled',
      label: t('detail.actions.sendToReview'),
      onClick: () => {},
      variant: 'primary',
      disabled: true,
      disabledTitle: t('detail.actions.sendToReviewDisabledTooltip'),
    },
    availability.canStartNewVersion && {
      id: 'start-new-version',
      label: t('detail.actions.startNewVersion'),
      onClick: () => controller.setModal('nueva-version'),
      variant: 'primary',
      disabled: !!availability.otraVersionEnProceso,
      disabledTitle: tooltipYaExiste,
    },
    availability.canCreateVersion && {
      id: 'create-version',
      label: t('detail.actions.createNewVersion'),
      onClick: () => controller.setModal('nueva-version'),
      variant: 'secondary',
      disabled: !!availability.otraVersionEnProceso,
      disabledTitle: tooltipYaExiste,
    },
    availability.canStartPeriodic && {
      id: 'start-periodic',
      label: t('detail.actions.startPeriodicReview'),
      onClick: () => controller.setModal('revision-periodica'),
      variant: 'secondary',
    },
    availability.canCancelReview && {
      id: 'cancel-review',
      label: t('detail.actions.cancelReview'),
      onClick: () => controller.setModal('confirm-cancel'),
      variant: 'secondary',
    },
    availability.canDelete && {
      id: 'delete',
      label: t('detail.actions.delete'),
      onClick: () => controller.setModal('confirm-delete'),
      variant: 'danger',
    },
  ]

  return items.filter((item): item is ManagementActionItem => item !== false)
}
