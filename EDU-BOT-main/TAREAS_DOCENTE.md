# Tareas y entregas del docente

El administrador (`5219381949915`, también reconocido como `529381949915`) puede
crear tareas por grupo y asignar los puntos manualmente. No hay descuentos por fecha.
Este módulo es independiente de los recordatorios personales de tareas del alumno.

## Comandos

`sincronizar entregas` recupera las ediciones manuales de **Estado** y **Puntos**
de la pestaña Entregas y muestra las diferencias con Tareas_Grupo. Es exclusivo
del administrador y del periodo actual. Pulsa **Aplicar cambios** para que los
alumnos vean los nuevos valores en `mi registro FOLIO`, o **Cancelar** para salir.
La propuesta vence en 10 minutos; tras reiniciar el bot, solicita otra propuesta.

No modifiques claves, folios, grupo, materia ni docente. Se cruza por clave de
tarea y folio, no por posición o nombre. Entregó admite puntos de 0 a 999999.99
con hasta dos decimales (punto o coma); No entregó requiere 0; Sin revisar requiere
puntos vacíos. También se pueden corregir entregas históricas de alumnos Dual.
No crea tareas ni alumnos ni interpreta filas borradas como faltas de entrega.
Duplicados, claves desconocidas o datos incompatibles bloquean toda la importación.

Al confirmar se vuelven a leer las hojas: si cambiaron, hay que revisar una nueva
propuesta. No edites mientras se guarda y usa una sola instancia del bot. El estado
y puntaje anteriores completos se conservan en Historial_Entregas, junto con los
nuevos, en la misma operación que actualiza las tareas y entregas. Las operaciones
del bot solo escriben entregas cuyo registro interno cambió; consultar, cancelar o
trabajar con otra entrega no debe borrar ediciones manuales pendientes. Una
calificación explícita del mismo alumno y tarea sí reemplaza esos valores.

| Comando | Función |
| --- | --- |
| `tareas grupo` | Cantidad y listado de tareas de todos los grupos del periodo actual, incluidos los que tienen cero. |
| `tareas grupo 5A MAM` | Tareas de ese grupo con clave, nombre, materia, valor y avance de calificación. |
| `crear tarea 5A MAM` | Pregunta materia si hay varias, nombre y valor; confirmar crea una clave única como T01. |
| `revisar tarea 5A MAM` | Elegir exclusivamente entre las tareas del grupo, luego revisar alumno por alumno. |
| `revisar tarea lista 5A MAM` | Elegir tarea y ver a todos los alumnos activos numerados; registrar en una sola respuesta con 1 o 0. |
| `revisar pendientes 5A MAM` | Elegir tarea, indicar puntaje común y revisar pendientes numerados. |
| `entregaron 1, 3-5` | Seleccionar alumnos de la revisión de pendientes; mostrar nombres y confirmar el lote. |
| `anterior tarea` | Volver al alumno anterior y corregir su entrega. |
| `pausar tarea` | Conservar el avance y dejar libre el chat. |
| `continuar tarea` | Retomar la última tarea seleccionada por el primer alumno sin revisar. |
| `finalizar tarea` | Si hay alumnos sin revisar, preguntar si se marcan No entregó con cero. Solo se hace al confirmar. |
| `entrega T01 EDU-5AMAM-015 0.7` | Proponer entrega con puntaje manual y confirmar antes de guardar. |
| `entrega T01 EDU-5AMAM-015` | Pedir el puntaje y luego confirmarlo. |
| `pendientes tarea 5A MAM` | Elegir tarea y ver separados No entregó y Sin revisar. |
| `resumen tarea 5A MAM` | Elegir tarea y consultar estados y puntos por alumno. |
| `tareas alumno EDU-5AMAM-015` | Tareas del alumno del periodo actual y suma de sus puntos vigentes. |

Durante la revisión, los botones son **Entregó**, **No entregó** y **Otro puntaje**.
También se aceptan esos textos. Entregó asigna el valor de la tarea; No entregó
asigna cero. Otro puntaje pide un número y confirmación. Cero puntos con estado
Entregó es diferente de No entregó. Las cantidades aceptan punto o coma y hasta
dos decimales, desde 0 hasta 999999.99; el valor inicial de una tarea debe ser mayor
que cero. Se permite superar el valor inicial si el docente así lo decide.

Las tareas tienen claves globales consecutivas: el mismo nombre en otro grupo es
una tarea distinta. Las entregas posteriores verifican grupo, periodo y estado activo
del alumno, y sustituyen el puntaje anterior. No lo suman nuevamente. Las claves
se conservan: no borrar filas para evitar reutilizar consecutivos.

Cada tarea creada durante el primer parcial se etiqueta internamente como `P1`.
Los cálculos de `mi registro` usan solo tareas de ese parcial; las tareas existentes
de antes de la etiqueta también se interpretan como `P1`. El desglose de la
calificación está en `EXAMENES.md`.

## Calificar varias tareas a la vez

Primero crea las tareas normalmente. Escribe `calificar tareas 5A MAM` y selecciona
de 2 a 10 claves con `tareas juntas T01,T02,T03`. Deben ser del mismo grupo,
materia, periodo y valor. El bot muestra a los alumnos activos numerados.

- Misma entrega en todas: `entregas juntas 1-5.7,9`.
- Entregas distintas: `entregas juntas T01: 1-5; T02: 2,7; T03: todos`.
- Admite `todos` o `ninguno`, comas, puntos y rangos; también puedes separar
  las tareas con saltos de línea. Debes incluir cada tarea seleccionada una vez.

En cada tarea los seleccionados reciben su valor completo y los demás
**No entregó · 0**. El resumen pide **Guardar todas** antes de reemplazar los
puntajes anteriores. **Corregir listas** permite cambiar la selección.
`continuar tareas juntas` recupera el paso guardado, incluso tras reiniciar;
`cancelar tareas juntas` descarta la propuesta pendiente.

Cada tarea conserva entregas e historial independientes. Se guarda el conjunto
en una sola operación, sin modificar la estructura de las hojas. Los alumnos Dual
quedan excluidos. Si cambia el padrón o una tarea mientras revisas, debes volver
a seleccionar para evitar aplicar una lista desactualizada. Estos comandos son
exclusivos del docente y no se confunden con las tareas personales del alumno.

## Consulta de tareas cargadas

`tareas grupo` permite comparar lo cargado en cada grupo. `tareas grupo GRUPO`
limita la consulta a uno. Cada tarea muestra clave, nombre, materia, valor,
alumnos revisados y pendientes. **Calificada** significa que todos los alumnos
activos están revisados, incluido No entregó con 0; **Parcialmente calificada**,
que faltan algunos; **Sin calificar**, que no se ha revisado a ninguno.
Las tareas sin alumnos activos se indican aparte. Las altas nuevas cuentan como
pendientes y los alumnos que dejaron el grupo no cuentan en el avance actual.
La consulta no modifica registros ni interrumpe la revisión abierta. Solo muestra
tareas creadas: no puede identificar una tarea que todavía no se haya registrado.
Usa `comandos` para consultar la guía del bot.

## Revisión de pendientes por lote

Para registrar al grupo completo, usa `revisar tarea lista GRUPO`, elige la tarea
y responde, por ejemplo, `entregaron 1-7.9, 10-15,19-39`. Los números son los de
la lista mostrada; admite comas, puntos y rangos inclusivos. Se guarda directamente
en una sola respuesta: los seleccionados reciben **Entregó · 1 punto** y los demás
**No entregó · 0 puntos**, reemplazando los registros anteriores de esa lista,
independientemente del valor original de la tarea. También acepta `entregaron todos`
y `entregaron ninguno`. Puedes pausar y continuar conservando la numeración.
Si cambia el padrón activo o algún número es inválido, no se aplica el lote.

### Entregas posteriores

`revisar pendientes GRUPO` pide un puntaje para esa revisión, sin cambiar el valor
original de la tarea ni los puntos de entregas anteriores. Muestra dos secciones:
No entregó (cero puntos) y Sin revisar (sin puntuación). Ambas usan números estables
que se conservan hasta terminar o iniciar otra revisión. Al desaparecer un alumno
por entregar, los demás no se renumeran. Al pausar y continuar se recuperan los
mismos números y el puntaje, incluso después de reiniciar el bot.

`entregaron 1, 3-5` presenta los nombres y puntos antes de guardar. Se puede indicar
explícitamente una entrega desde cualquiera de las dos secciones. El lote se guarda
junto, con historial por alumno. Los no seleccionados conservan su estado. Si cambió
el grupo o la entrega de alguno de los seleccionados, se rechaza el lote completo
para revisarlo de nuevo; nunca se aplica parcialmente.

Al finalizar, la propuesta de poner ceros lista a los alumnos Sin revisar. Rechazarla
conserva ese estado. Confirmarla los marca No entregó con cero, sin afectar las
entregas ya registradas. Las entregas tardías pueden actualizar esos ceros después.

Al cambiar explícitamente de tareas a pase de lista, o viceversa, se pausa el módulo
anterior. Usar `continuar tarea` o `continuar lista` para recuperar el avance.

## Google Sheets

Se usan las mismas variables SPREADSHEET_ID y KEY_FILE, sin nuevas credenciales.
Se crean estas pestañas al usar el módulo:

- **Tareas_Grupo**: clave, creación UTC, grupo, materia, nombre, valor y datos de tarea.
- **Entregas**: tarea, grupo, materia, alumno, estado, puntos numéricos, actualización UTC y docente.
- **Control_Tareas**: paso persistente de la revisión o creación.
- **Historial_Entregas**: estado y puntos antes/después, fecha, docente e ID del mensaje.

Las fechas son referencias de registro, no fechas límite ni base para penalizaciones.
Las altas nuevas se incorporan como Sin revisar al abrir una revisión o reporte;
las entregas anteriores se conservan. Si un alumno cambia de grupo, sus entregas
históricas no se borran; las entregas posteriores solo se admiten en su grupo actual.

No editar las pestañas directamente: actualizar con el bot para mantener consistentes
la tarea y el historial. Ante encabezados incompatibles se detiene la operación sin
reescribirlos. Usar una sola instancia del bot: los consecutivos y escrituras se
serializan dentro de un proceso. Tarea, entrega, control y auditoría se guardan juntos
antes de responder. Los mensajes repetidos y botones antiguos no avanzan dos alumnos.

Validación local: `npm test`, con Sheets y WhatsApp simulados. Tras el despliegue,
crear una tarea de prueba y comprobar una entrega en la hoja desde el número docente.
