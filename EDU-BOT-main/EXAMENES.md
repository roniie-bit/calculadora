# Exámenes por grupo

El docente prepara una sola pestaña llamada **Examenes** con el grupo completo.
Cada alumno tiene una fila por materia y dos columnas editables:

- **Primer parcial**
- **Segundo parcial**

Ambas columnas se crean en `0`. El significado operativo es:

- `0` y `0`: no hay exámenes presentados.
- `5` y `0`: el alumno ya tiene registrado el primer parcial.
- `5` y `7`: tiene registrados ambos parciales.

El docente puede editar directamente las dos columnas en Google Sheets. Los
cambios no aparecen todavía en `mi registro FOLIO`; para publicarlos debe enviar
`sincronizar examenes` desde el WhatsApp del administrador, revisar la vista previa
y pulsar **Aplicar cambios**.

## Comandos

| Comando | Resultado |
| --- | --- |
| `crear examenes 5A MAM` | Crea o completa las filas del grupo, iniciando ambos parciales en 0. |
| `crear examenes` | Prepara todos los grupos activos del periodo actual. |
| `sincronizar examenes` | Lee las ediciones manuales y pide confirmación antes de publicarlas. |
| `sincronizar examenes 5A MAM` | Limita la sincronización a un grupo. |

Los comandos son exclusivos del administrador. La propuesta de sincronización
vence en 10 minutos. Si la hoja cambia después de la vista previa, el bot rechaza
todo el lote y solicita una nueva sincronización.

## Pestaña Examenes

La tabla visible contiene:

| Columna | Uso |
| --- | --- |
| Grupo | Grupo del alumno. |
| Materia | Materia del examen. 5A LCM y 5B LCM tienen una fila por cada materia. |
| Periodo | Periodo escolar actual. |
| Folio | Identificador del alumno. |
| Nombre alumno | Nombre tomado del registro. |
| Primer parcial | Calificación de 0 a 10. |
| Segundo parcial | Calificación de 0 a 10. |
| Actualización UTC | Última fecha de preparación o sincronización. |
| Docente | Número del administrador. |

El bot crea automáticamente las pestañas internas `Control_Examenes` y
`Historial_Examenes`. `Control_Examenes` conserva la última versión publicada;
`Historial_Examenes` guarda el valor anterior y nuevo de cada cambio.

Si una pestaña `Examenes` ya existe con el formato anterior sin la columna
`Materia`, el bot se detiene para no adjudicar la misma calificación a las dos
materias. Hay que migrarla o recrearla antes de usar la sincronización nueva.

## Calificación del primer parcial

`mi registro FOLIO` calcula una calificación independiente por materia:

| Componente | Peso | Cálculo |
| --- | ---: | --- |
| Tareas | 40% | puntos obtenidos / puntos posibles de tareas revisadas × 40 |
| Asistencia | 30% | asistencia efectiva / clases finalizadas × 30 |
| Examen | 30% | primer parcial / 10 × 30 |
| Total | 100% | suma de los componentes |

Un retardo cuenta como asistencia. Cada grupo de tres retardos descuenta una
asistencia efectiva. Las tareas `Sin revisar`, las listas abiertas y las clases
sin marcar no se incluyen en el cálculo; mientras existan, la calificación se
muestra como **preliminar**.

Los puntos de una tarea se normalizan por el valor de esa tarea. Si un puntaje
supera el valor configurado, el cálculo lo limita al valor máximo de la tarea.

El primer parcial usa únicamente la columna `Primer parcial`. El segundo parcial
se calculará por separado cuando el docente lo habilite.

Para generar una pestaña con todos los alumnos y el desglose completo, usa
`procesar calificaciones`. La pestaña `Calificaciones_Primer_Parcial` se
recalcula completa cada vez que se ejecuta el comando. El detalle está en
`CALIFICACIONES.md`.

## Consulta del alumno

`mi registro FOLIO` incluye una sección de exámenes. Solo se muestra la última
versión sincronizada. El alumno debe escribir desde el WhatsApp registrado; el
administrador puede consultar cualquier folio.

Si una fila tiene `0` en ambos parciales, el mensaje indica **Sin exámenes
presentados**. Si tiene `5` y `0`, indica que el primer parcial está registrado.
Un parcial en `0` no se interpreta como una calificación aprobatoria; es el valor
inicial usado para indicar que todavía no hay un examen registrado.

## Validaciones

- Solo se aceptan números entre 0 y 10, con hasta dos decimales; también se
  acepta coma decimal.
- Una fila con folio desconocido, grupo incorrecto, periodo distinto o folio
  duplicado bloquea toda la sincronización.
- Los alumnos Dual se omiten al crear el grupo, pero sus filas y calificaciones
  históricas se conservan.
- Las ediciones manuales se cruzan por grupo y folio, no por nombre.
- El historial y la versión publicada se guardan en el mismo lote.

## Uso recomendado

1. Enviar `crear examenes GRUPO`.
2. Abrir la pestaña **Examenes** y capturar las calificaciones.
3. Enviar `sincronizar examenes`.
4. Revisar la lista de cambios y pulsar **Aplicar cambios**.
5. Pedir a un alumno de prueba que consulte `mi registro FOLIO`.

Las pruebas locales usan Sheets simulado: `npm test`.
