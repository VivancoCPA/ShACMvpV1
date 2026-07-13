export interface ClausulaISO {
  codigo: string
  titulo: string
  subclausulas?: { codigo: string; titulo: string }[]
}

export const CLAUSULAS_ISO: Record<'ISO_9001_2015' | 'ISO_45001_2018', ClausulaISO[]> = {
  ISO_9001_2015: [
    {
      codigo: '4',
      titulo: 'Contexto de la organización',
      subclausulas: [
        { codigo: '4.1', titulo: 'Comprensión de la organización y de su contexto' },
        { codigo: '4.2', titulo: 'Comprensión de las necesidades y expectativas de las partes interesadas' },
        { codigo: '4.3', titulo: 'Determinación del alcance del sistema de gestión de la calidad' },
        { codigo: '4.4', titulo: 'Sistema de gestión de la calidad y sus procesos' },
      ],
    },
    {
      codigo: '5',
      titulo: 'Liderazgo',
      subclausulas: [
        { codigo: '5.1', titulo: 'Liderazgo y compromiso' },
        { codigo: '5.2', titulo: 'Política' },
        { codigo: '5.3', titulo: 'Roles, responsabilidades y autoridades en la organización' },
      ],
    },
    {
      codigo: '6',
      titulo: 'Planificación',
      subclausulas: [
        { codigo: '6.1', titulo: 'Acciones para abordar riesgos y oportunidades' },
        { codigo: '6.2', titulo: 'Objetivos de la calidad y planificación para lograrlos' },
        { codigo: '6.3', titulo: 'Planificación de los cambios' },
      ],
    },
    {
      codigo: '7',
      titulo: 'Apoyo',
      subclausulas: [
        { codigo: '7.1', titulo: 'Recursos' },
        { codigo: '7.1.5', titulo: 'Recursos de seguimiento y medición' },
        { codigo: '7.2', titulo: 'Competencia' },
        { codigo: '7.3', titulo: 'Toma de conciencia' },
        { codigo: '7.4', titulo: 'Comunicación' },
        { codigo: '7.5', titulo: 'Información documentada' },
      ],
    },
    {
      codigo: '8',
      titulo: 'Operación',
      subclausulas: [
        { codigo: '8.1', titulo: 'Planificación y control operacional' },
        { codigo: '8.2', titulo: 'Requisitos para los productos y servicios' },
        { codigo: '8.3', titulo: 'Diseño y desarrollo de los productos y servicios' },
        { codigo: '8.4', titulo: 'Control de los procesos, productos y servicios suministrados externamente' },
        { codigo: '8.4.1', titulo: 'Generalidades (control de proveedores externos)' },
        { codigo: '8.5', titulo: 'Producción y provisión del servicio' },
        { codigo: '8.5.2', titulo: 'Identificación y trazabilidad' },
        { codigo: '8.6', titulo: 'Liberación de los productos y servicios' },
        { codigo: '8.7', titulo: 'Control de las salidas no conformes' },
      ],
    },
    {
      codigo: '9',
      titulo: 'Evaluación del desempeño',
      subclausulas: [
        { codigo: '9.1', titulo: 'Seguimiento, medición, análisis y evaluación' },
        { codigo: '9.2', titulo: 'Auditoría interna' },
        { codigo: '9.3', titulo: 'Revisión por la dirección' },
      ],
    },
    {
      codigo: '10',
      titulo: 'Mejora',
      subclausulas: [
        { codigo: '10.1', titulo: 'Generalidades' },
        { codigo: '10.2', titulo: 'No conformidad y acción correctiva' },
        { codigo: '10.3', titulo: 'Mejora continua' },
      ],
    },
  ],
  ISO_45001_2018: [
    {
      codigo: '4',
      titulo: 'Contexto de la organización',
      subclausulas: [
        { codigo: '4.1', titulo: 'Comprensión de la organización y de su contexto' },
        { codigo: '4.2', titulo: 'Comprensión de las necesidades y expectativas de los trabajadores' },
        { codigo: '4.3', titulo: 'Determinación del alcance del sistema de gestión de la SST' },
        { codigo: '4.4', titulo: 'Sistema de gestión de la SST' },
      ],
    },
    {
      codigo: '5',
      titulo: 'Liderazgo y participación de los trabajadores',
      subclausulas: [
        { codigo: '5.1', titulo: 'Liderazgo y compromiso' },
        { codigo: '5.2', titulo: 'Política de la SST' },
        { codigo: '5.3', titulo: 'Roles, responsabilidades y autoridades en la organización' },
        { codigo: '5.4', titulo: 'Consulta y participación de los trabajadores' },
      ],
    },
    {
      codigo: '6',
      titulo: 'Planificación',
      subclausulas: [
        { codigo: '6.1', titulo: 'Acciones para abordar riesgos y oportunidades' },
        { codigo: '6.1.2', titulo: 'Identificación de peligros y evaluación de riesgos' },
        { codigo: '6.2', titulo: 'Objetivos de la SST y planificación para lograrlos' },
      ],
    },
    {
      codigo: '7',
      titulo: 'Apoyo',
      subclausulas: [
        { codigo: '7.1', titulo: 'Recursos' },
        { codigo: '7.2', titulo: 'Competencia' },
        { codigo: '7.3', titulo: 'Toma de conciencia' },
        { codigo: '7.4', titulo: 'Comunicación' },
        { codigo: '7.5', titulo: 'Información documentada' },
      ],
    },
    {
      codigo: '8',
      titulo: 'Operación',
      subclausulas: [
        { codigo: '8.1', titulo: 'Planificación y control operacional' },
        { codigo: '8.1.2', titulo: 'Eliminación de peligros y reducción de riesgos para la SST' },
        { codigo: '8.2', titulo: 'Preparación y respuesta ante emergencias' },
      ],
    },
    {
      codigo: '9',
      titulo: 'Evaluación del desempeño',
      subclausulas: [
        { codigo: '9.1', titulo: 'Seguimiento, medición, análisis y evaluación del desempeño' },
        { codigo: '9.1.2', titulo: 'Evaluación del cumplimiento' },
        { codigo: '9.2', titulo: 'Auditoría interna' },
        { codigo: '9.3', titulo: 'Revisión por la dirección' },
      ],
    },
    {
      codigo: '10',
      titulo: 'Mejora',
      subclausulas: [
        { codigo: '10.1', titulo: 'Generalidades' },
        { codigo: '10.2', titulo: 'Incidentes, no conformidades y acciones correctivas' },
        { codigo: '10.3', titulo: 'Mejora continua' },
      ],
    },
  ],
}
