import { samePhone } from '../utils/phone.js';

export const ADMIN_COMMAND_PAGES = [
`🆕 COMANDOS NUEVOS · 1/6

sincronizar entregas — Recuperar cambios manuales de Estado y Puntos en Entregas. Muestra diferencias; pulsa Aplicar cambios para actualizar mi registro. Valida tarea y folio, conserva valores anteriores en el historial. La propuesta vence en 10 minutos.

VARIAS TAREAS A LA VEZ
calificar tareas 5A MAM — Mostrar tareas existentes.
tareas juntas T01,T02,T03 — Elegir tareas del mismo valor y materia.
entregas juntas 1-5,7 — Mismos alumnos para todas.
entregas juntas T01: 1-5; T02: 2,7; T03: todos — Una lista por tarea.
Seleccionados reciben el valor de cada tarea; los demás 0. Revisa el resumen y pulsa Guardar todas.

recuperar primera asistencia — Vista previa de las primeras clases verificadas de septiembre 2026. Completa presentes/faltas según fecha de alta, conserva marcas existentes y excluye Dual. Requiere Guardar.

CAMBIAR TELÉFONO DEL ALUMNO
cambiar telefono EDU-5AMAM-015 9381234567
Escribe 10 dígitos sin espacios ni guiones. Revisa nombre, folio, número anterior y nuevo; pulsa Guardar cambio o Cancelar. La confirmación vence en 10 minutos. Se conserva el historial del alumno.

EXÁMENES POR GRUPO
crear examenes 5A MAM — Crea o completa la pestaña Examenes con el grupo y ambos parciales en 0.
crear examenes — Prepara todos los grupos activos.
sincronizar examenes — Revisa las calificaciones editadas en Examenes y confirma para publicarlas en mi registro.
procesar calificaciones — Recalcula todos los alumnos y reescribe Calificaciones_Primer_Parcial.
procesar calificaciones 5A MAM — Recalcula solo ese grupo.
Las columnas son Materia, Primer parcial y Segundo parcial. 5A LCM y 5B LCM tienen una fila por materia. 0 y 0 significa que no hay exámenes presentados; 5 y 0 significa que ya hay primer parcial. Los cambios de la hoja no se publican hasta confirmar la sincronización. La calificación usa tareas 40%, asistencia 30% y examen 30%; tres retardos descuentan una asistencia.

CONSULTA DEL ALUMNO
mi registro EDU-5AMAM-015
Muestra el desglose del primer parcial por materia: tareas 40%, asistencia 30% y examen 30%, además de tareas y asistencias por fecha. El alumno usa su WhatsApp registrado; el administrador puede consultar cualquier folio.

ALUMNOS DUAL
dual EDU-5AMAM-015 — Ocultar de listas de trabajo sin borrar datos.
alumnos duales 5A MAM — Consultar duales del grupo; sin grupo muestra todos.
activar alumno EDU-5AMAM-015 — Volver a incluirlo en las listas.

ASISTENCIA POR NÚMEROS
pasar lista numeros 5A MAM — Elegir materia si corresponde y pulsar Comenzar.
faltas 2,6-8 — Seleccionados con falta; los demás presentes. Reemplaza marcas anteriores de esa lista.
retardos lista 5A MAM — Abrir lista para corregir retardos.
retardos 6,21-22 — Solo esos alumnos cambian a Retardo.

TAREAS POR LISTA Y CONSULTA POR GRUPO
revisar tarea lista 5A MAM — Elegir tarea y ver alumnos numerados.
entregaron 1-7.9,10-15 — Seleccionados con 1 punto; los demás con 0. Reemplaza registros anteriores de esa lista.
tareas grupo — Ver tareas cargadas y avance de calificación de todos los grupos.
tareas grupo 5A MAM — Consultar un grupo.

Usa siempre los números de la lista mostrada. Las respuestas por números se guardan directamente. El pase individual y las tareas personales del alumno siguen disponibles.
Las páginas siguientes contienen la guía completa.`,
`📖 COMANDOS EDU-BOT · 2/6

Escribe comandos cuando necesites esta guía. También acepta ayuda admin.
Sustituye los grupos, folios, claves y fechas de los ejemplos por los tuyos.
Consultar esta guía no modifica ni pausa tu trabajo.

👥 ALUMNOS
registrarme — Alta de alumno.
mis grupos — Cantidades de alumnos por grupo.
lista 5A MAM — Nombres y folios del grupo.
dual EDU-5AMAM-015 — Marcar como Dual y ocultar de listas de trabajo, conservando registro e historial.
alumnos duales — Consultar alumnos del programa Dual.
alumnos duales 5A MAM — Consultar duales de un grupo.
activar alumno EDU-5AMAM-015 — Devolver un alumno Dual a las listas con su mismo folio.
cambiar telefono EDU-5AMAM-015 9381234567 — Revisar número anterior/nuevo y confirmar con Guardar cambio. Usa 10 dígitos mexicanos sin espacios ni guiones; admite 52, +52 o 521 como prefijo.

Grupos: 5A MAM, 5A LCM, 5B LCM, 5A CM, 5B CM, 5A PABM y 3A EV.

Para salir de una revisión antes de usar otra función: pausar lista o pausar tarea.`,
`📋 PASE DE LISTA · 3/6

pasar lista 5A MAM — Iniciar o recuperar la clase de hoy.
pasar lista numeros 5A MAM — Mostrar alumnos numerados para pasar asistencia de hoy en una respuesta.
faltas 2,6-8 — Seleccionados Falta; los demás de la lista Presente. Reemplaza marcas previas.
faltas ninguno / faltas todos — Todos presentes o todos con falta en esa lista.
retardos lista 5A MAM — Mostrar lista para corregir retardos de hoy.
retardos lista 5A MAM 2026-09-08 — Corregir retardos de otra fecha; elegir materia si hay varias.
retardos 6,21-22 — Solo esos alumnos pasan a Retardo; los demás conservan su estado.
retardos todos / retardos ninguno — Cambiar toda la lista a Retardo o conservar todas sus marcas.
P / F / R — Presente, falta o retardo durante el pase.
anterior — Corregir al alumno anterior del pase de lista.
pausar lista — Guardar y pausar.
continuar lista — Retomar una lista abierta.
continuar lista 5A MAM — Filtrar listas abiertas por grupo.
ver faltas — Faltantes de la clase seleccionada.
resumen lista — Conteos y faltantes.
finalizar lista — Cerrar cuando no hay pendientes.

corregir EDU-5AMAM-001 — Elegir estado para hoy.
retardo EDU-5AMAM-001 — Proponer retardo para hoy.
corregir EDU-5AMAM-001 2026-09-08 — Corregir otra fecha.
retardo EDU-5AMAM-001 2026-09-08 — Retardo en otra fecha.
corregir lista 5A MAM 2026-09-08 — Abrir la clase numerada para corrección masiva.
presentes/justificar 2,5-7 · faltas 3,8 · retardos 1,4 — Cambiar solo esos números.
corregir alumno EDU-5AMAM-015 — Listar las asistencias del alumno para elegir fechas.
corregir EDU-5AMAM-015 2026-10-18,2026-10-19 — Listar solo esas fechas del alumno.

Las correcciones por folio requieren confirmación. Faltas y retardos por números se guardan directamente. Usa los números de la lista mostrada; acepta puntos, comas y rangos. Si hay varias materias, eliges la clase.`,
`📚 TAREAS Y ENTREGAS · 4/6

crear tarea 5A MAM — Nombre, materia y valor.
sincronizar entregas — Importar Estado y Puntos editados en Entregas al periodo actual, con vista previa y confirmación. No cambies claves, folios, grupo, materia ni docente. Entregó requiere puntos; No entregó requiere 0; Sin revisar requiere puntos vacíos.
calificar tareas 5A MAM — Iniciar revisión conjunta de tareas existentes.
tareas juntas T01,T02 — Elegir de 2 a 10 tareas del mismo grupo, materia y valor.
entregas juntas 1-5.7 — Aplicar la misma lista a todas las tareas seleccionadas.
entregas juntas T01: 1-5; T02: 3,7 — Listas distintas en un mensaje; incluir todas las tareas. Admite todos y ninguno.
Seleccionados reciben el valor completo de cada tarea; los demás No entregó con 0. Reemplaza puntos anteriores al pulsar Guardar todas.
continuar tareas juntas — Recuperar lista o resumen.
cancelar tareas juntas — Salir sin aplicar la propuesta pendiente.
tareas grupo — Cantidad y lista de tareas por grupo, incluidos grupos sin tareas.
tareas grupo 5A MAM — Claves, nombres, materias y avance: calificadas, parciales o sin calificar.
revisar tarea 5A MAM — Elegir una tarea del grupo.
revisar tarea lista 5A MAM — Lista numerada: entregaron 1-7.9, 10-15; seleccionados 1 y los demás 0.
revisar pendientes 5A MAM — Elegir tarea y puntaje común; ver pendientes numerados.
entregaron 1, 3-5 — En pendientes: seleccionar y confirmar. En tarea lista: guardar seleccionados con 1 y los demás con 0, reemplazando registros anteriores.
entregaron todos / entregaron ninguno — Solo en tarea lista: asignar 1 a todos o 0 a todos.
Entregó / No entregó / Otro puntaje — Respuestas durante la revisión; también hay botones.
anterior tarea — Regresar al alumno anterior.
pausar tarea — Conservar el avance.
continuar tarea — Retomar la última tarea.
finalizar tarea — Terminar; pregunta si quieres poner No entregó · 0 a los alumnos sin revisar.

entrega T01 EDU-5AMAM-001 0.7 — Registrar o cambiar puntos, con confirmación.
entrega T01 EDU-5AMAM-001 — El bot pregunta el puntaje.
pendientes tarea 5A MAM — Elegir tarea; separa No entregó y Sin revisar.
resumen tarea 5A MAM — Estados y puntos por alumno.
tareas alumno EDU-5AMAM-001 — Tareas y puntos acumulados.

T01 es una clave de ejemplo. Cada tarea pertenece a un grupo; no hay descuentos automáticos por fecha. Tareas grupo consulta el periodo actual sin interrumpir la revisión; calificada incluye No entregó con 0.`,
`🎓 FUNCIONES GENERALES · 5/6

Usa estas funciones fuera de una revisión activa:
hola — Bienvenida y menú.
registrarme — Registro; permite un dispositivo compartido.
asistencia — Asistencia del alumno por ubicación (distinta del pase docente).
ubicacion — Ubicación del plantel.
calificaciones — Consulta del registro de calificaciones existente.
tareas — Menú de tareas personales y recordatorios del alumno.
mis tareas — Tareas personales pendientes; distinto de tareas alumno FOLIO.
mi registro EDU-5AMAM-015 — Consulta del alumno: tareas, puntos, presentes, retardos y faltas. Desde su WhatsApp registrado; el docente también puede consultar.
encuesta01 — Encuesta.
fisica1 — Examen de física.
examen1 — Examen de matemáticas.
quimica01 — Examen de química.
apoyo emocional — Módulo de acompañamiento.
borrarmisdatospersonales — Solicitud de eliminación; requiere confirmación.

También puedes escribir una pregunta académica para consultar al tutor IA.
cancelar — Cancela el registro o sale de los módulos docentes; en los otros flujos usa sus botones de salida.`,
`🛠 FUNCIONES HEREDADAS · 6/6

startchat NUMERO — Iniciar chat con un alumno.
stopchat — Comando previsto para terminarlo. Hay un problema conocido: durante el chat puede reenviarse como texto en lugar de cerrar.

aviso / masivo / anuncio — Activadores de envíos masivos. Este flujo tiene una llamada incompleta y está pendiente de reparación; no usar para enviar avisos todavía.

El calendario tiene código, pero no está conectado a un comando del manejador actual.

Esta guía incluye los comandos principales de cada función; las respuestas adicionales se eligen siguiendo los botones o preguntas del bot.`
];

export function createAdminCommandsFlow({ adminNumber, send }) {
  return async (phone, raw = '') => {
    const command = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!['comandos', 'ayuda admin', 'mis comandos'].includes(command)) return false;
    const pages = samePhone(phone, adminNumber) ? ADMIN_COMMAND_PAGES : ['La guía de comandos está disponible únicamente para el administrador.'];
    for (const body of pages) await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
    return true;
  };
}
