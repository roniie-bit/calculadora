# Registro de alumnos

## Consulta de tareas y asistencias del alumno

El alumno envía `mi registro EDU-5AMAM-015`, sustituyendo el ejemplo por su folio.
El bot consulta el periodo vigente y muestra:

- Cada tarea del docente con clave, nombre, materia, estado de entrega, puntos
  registrados y valor de la tarea. La suma de puntos no es un promedio ni una
  calificación final. Sin revisar se muestra sin calificar, no como cero.
- Cantidades de presentes, retardos, faltas y registros pendientes, con detalle
  por fecha y materia. Las listas aún abiertas se identifican y Pendiente no cuenta
  como Falta. Se consulta el pase docente, no la asistencia por ubicación.

El folio debe corresponder al WhatsApp registrado, aceptando las variantes mexicanas
52 y 521. El docente puede consultar cualquier folio desde su número configurado.
Si comparten dispositivo, se consulta el folio solicitado entre los registros
asociados a ese teléfono. Si el alumno cambió de teléfono, debe solicitar al docente
la actualización de su registro. Los alumnos Dual también pueden consultar sus
registros históricos del periodo actual.

La consulta no modifica tareas, marcas ni controles de revisión. Se atiende antes
de los módulos activos y no captura folios enviados solos, ya que se usan en otras
operaciones. `mi registro` sin folio explica el formato. `mis tareas` sigue siendo
la consulta de recordatorios personales; no cambia su funcionamiento.

La misma consulta incluye los exámenes sincronizados y una calificación del primer
parcial por materia. El desglose muestra tareas (40%), asistencia (30%) y examen
(30%), con la cuenta usada y el total. `0` y `0` significa que no hay exámenes
presentados y `5` y `0` significa que ya está registrado el primer parcial.
Las tareas sin revisar y las listas abiertas se excluyen y la calificación se
marca como preliminar. Cada tres retardos descuentan una asistencia efectiva.
El detalle operativo está en `EXAMENES.md`.
El docente puede generar el reporte consolidado de todo el periodo con
`procesar calificaciones`; la pestaña y sus columnas se describen en
`CALIFICACIONES.md`.

## Cambio de WhatsApp por el administrador

Usa `cambiar telefono EDU-5AMAM-015 9381234567`. También acepta `teléfono` con
acento. El número mexicano debe contener exactamente 10 dígitos nacionales,
sin espacios internos, guiones, letras ni extensiones. Se admiten los prefijos
52, +52, 521 o +521 y se normaliza a 52 seguido de los 10 dígitos.

Antes de guardar, el bot muestra nombre, folio, grupo, estado, número anterior
y nuevo. Se debe pulsar **Guardar cambio** o **Cancelar**. La propuesta vence
en 10 minutos y queda invalidada al iniciar otra o reiniciar el bot. No se acepta
un «sí» suelto que pudiera corresponder a una revisión de tareas o asistencia.
Solo el administrador puede solicitar y confirmar; no se permite asignar su
propio número como teléfono del alumno. Si el nuevo número está asociado a otros
folios, la propuesta avisa que se compartiría el acceso desde ese teléfono.

Al confirmar se vuelve a leer el registro, se comprueba que no cambió y se actualiza
únicamente la celda WhatsApp en Alumnos. El cambio y una entrada en
**Historial_Telefonos** se guardan en el mismo batch: fecha UTC, docente, folio,
teléfono anterior/nuevo, ID de cambio e ID del mensaje. El historial permite
reconocer reintentos después de respuestas fallidas sin repetir el cambio.
No se borran alumnos ni se cambian nombre, folio, grupo, estado Dual/Activo,
asistencias, entregas o datos del registro original.

El nuevo número podrá consultar `mi registro FOLIO`; el anterior perderá ese acceso
para ese folio. El comando no migra conversaciones ni recordatorios personales
asociados al número anterior. No envía mensajes a ninguno de los dos teléfonos.

## Proceso de alta

El alumno escribe `registrarme` o elige «Registrarme» en el menú. Selecciona grupo,
escribe apellidos y nombres y confirma. `cancelar` descarta el alta en curso.
Si el teléfono ya tiene registros, se pregunta si usa un dispositivo prestado
o compartido. Sí permite registrar a otra persona; No termina el alta.
Las correcciones posteriores se solicitan al docente y se realizan en la hoja.

## Almacenamiento

Se crea automáticamente `Alumnos` en el Google Sheets configurado en
`SPREADSHEET_ID`, usando `KEY_FILE` y los permisos existentes. No requiere nuevas claves.
Si ya existe una pestaña con ese nombre y encabezados diferentes, la operación
se detiene para evitar mezclar datos. La primera alta requiere acceso de escritura.

Cada fila contiene folio corto como `EDU-5AMAM-001`, grupo, primer apellido, segundo
apellido, nombres, nombre completo, WhatsApp, uso compartido, fecha UTC, periodo,
estado e identificador interno de solicitud. Se escriben como texto literal.
El folio usa el grupo de alta sin espacios y un consecutivo de al menos tres dígitos.
Se toma el mayor consecutivo guardado para ese prefijo (incluidas bajas y otros periodos)
y se suma uno. No borrar filas: usar Estado para las bajas, evitando reutilizar folios.
Los folios largos ya emitidos se conservan. El folio permanece al corregir grupo o teléfono.
El periodo es agosto de 2026 a
enero de 2027. Se registra una vez a cada alumno, incluso para grupos con dos materias.

## Docente

Desde `5219381949915` (también se reconoce `529381949915`):
el número se centraliza en `src/config/env.js`, propiedad `ADMIN_NUMBER`.
Esta configuración reemplaza los antiguos valores y la variable de entorno del mismo nombre.

- `mis grupos`: inscritos activos por grupo y total.
- `lista 5A LCM`: nombres ordenados y folios; acepta cualquiera de los siete grupos.

Los conteos corresponden a registros, no a una lista oficial de matrícula.
Para marcar una baja, cambiar Estado a `Baja`; para corregir nombre o grupo,
editar sus celdas sin modificar el folio. El mismo nombre y teléfono en el periodo
devuelve el registro existente: los homónimos que comparten teléfono requieren revisión docente.

## Alcance y operación

Las sesiones en curso duran 30 minutos y viven en memoria; un reinicio exige
comenzar nuevamente. Los registros confirmados permanecen en Sheets.
Las altas se serializan dentro de un proceso; usar una sola instancia para evitar
consecutivos repetidos y altas duplicadas simultáneas entre servidores.
El indicador compartido describe el dispositivo declarado al hacer esa alta.

El docente puede pasar lista por folio con el módulo descrito en `PASE_DE_LISTA.md`.
La selección de alumno en dispositivos compartidos para tareas, asistencia por
ubicación o calificaciones aún no está integrada: esos módulos siguen por teléfono.

Pruebas sin servicios externos: `node --test test/studentRegistration.test.js`.
Después de desplegar, completar un registro desde WhatsApp y comprobar su fila,
el folio recibido y los conteos desde el número del docente.
# Alumnos del programa Dual

El docente puede usar `dual EDU-5AMAM-015` para cambiar el estado a **Dual**.
Se conserva la fila de Alumnos, el folio, el grupo y todo el historial de entregas
y asistencias. No se borran registros ni se asignan ceros o faltas por este cambio.
El alumno deja de aparecer en `lista GRUPO`, los conteos de `mis grupos`, las
revisiones de tareas y el pase de lista, incluidas las sesiones ya creadas.

`alumnos duales` muestra los registros Dual del periodo actual;
`alumnos duales 5A MAM` filtra por grupo. Para devolverlo a las listas, usa
`activar alumno EDU-5AMAM-015`. Estos comandos son exclusivos del docente y
se atienden incluso durante una revisión. El cambio se guarda directamente.
Las listas nuevas incluyen solo alumnos Activo. Si una lista de asistencia fue
creada mientras el alumno estaba en Dual, no se agrega retroactivamente al reactivarlo;
las nuevas listas sí lo incluirán. Las tareas lo incorporan al abrir su revisión.

Si cambió a Dual el alumno que estaba en pantalla, su siguiente respuesta se
descarta y se muestra el siguiente alumno para evitar calificar a otra persona.
En registro de tareas por lista se debe abrir nuevamente la lista si cambió el
padrón, para usar la numeración actualizada. `tareas alumno FOLIO` permite consultar
las entregas históricas de un alumno Dual. Su módulo personal de recordatorios
permanece independiente.
