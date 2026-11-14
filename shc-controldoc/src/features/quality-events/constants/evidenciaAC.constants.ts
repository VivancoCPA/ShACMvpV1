// Espejo de EvidenciaAcFormatos (backend) — el servidor valida de verdad (extensión + firma real);
// el cliente solo evita subidas que ya sabe que van a fallar (ac-ejecucion-verificacion-evidencias).
export const EVIDENCIA_AC_EXTENSIONES = ['.pdf', '.jpg', '.jpeg', '.png', '.mp4', '.docx', '.xlsx']
export const EVIDENCIA_AC_ACCEPT = EVIDENCIA_AC_EXTENSIONES.join(',')
export const EVIDENCIA_AC_MAX_BYTES = 50 * 1024 * 1024
export const EVIDENCIA_AC_MAX_ARCHIVOS = 5
