# Pase de lista del docente

Disponible para el administrador configurado: `5219381949915`, también reconocido
como `529381949915`. Los alumnos no pueden marcar ni consultar esta lista del docente.

## Uso

1. Escribir `pasar lista 5A MAM` (cualquiera de los siete grupos registrados).
2. Para 5A LCM y 5B LCM, elegir materia. Para los demás se asigna la materia del horario.
3. Pulsar Comenzar. El bot recupera los alumnos activos del periodo agosto 2026–enero 2027,
   ordenados por nombre comenzando por apellidos.
4. Marcar cada alumno con los botones Presente, Falta o Retardo; también acepta P, F y R.
5. Revisar el resumen con cantidades y nombres de faltantes. Pulsar Finalizar o escribir
   `finalizar lista`. No se permite finalizar con alumnos pendientes.

| Comando | Resultado |
| --- | --- |
| `anterior` | Volver al alumno anterior para cambiar su marca. |
| `pausar lista` | Guardar el avance y liberar el chat para otras funciones. |
| `continuar lista` | Recuperar una lista abierta; si hay varias, elegir fecha y materia. |
| `continuar lista 5A MAM` | Filtrar las listas abiertas por grupo. |
| `ver faltas` | Mostrar faltantes de la clase seleccionada. |
| `resumen lista` | Mostrar conteos y faltantes de la clase seleccionada. |
| `retardo EDU-5AMAM-015` | Proponer cambiar a retardo en la clase de hoy; requiere confirmación. |
| `corregir EDU-5AMAM-015` | Elegir estado y confirmar el cambio para la clase de hoy. |
| `corregir EDU-5AMAM-015 2026-09-08` | Corregir una clase de otra fecha. También funciona con `retardo`. |
| `corregir lista 5A MAM 2026-09-08` | Abrir la clase completa numerada para cambiar varias asistencias. |
| `corregir asistencias 5A MAM 2026-09-08` | Alias de la corrección masiva por lista. |
| `corregir alumno EDU-5AMAM-015` | Mostrar todas las asistencias del alumno para elegir cuáles corregir. |
| `corregir EDU-5AMAM-015 2026-10-18, 2026-10-19` | Mostrar solo las asistencias del alumno en esas fechas. |
| `cancelar` | Salir de la operación conservando las marcas; una lista abierta queda pausada. |

Si hay dos materias para ese alumno en la fecha, siempre se pide elegir la clase.
También se pueden corregir listas finalizadas. El botón Corregir del resumen solicita
el folio y usa esa clase concreta. Para revisar una lista finalizada de hoy se puede
volver a iniciar el mismo grupo y materia: se recupera en lugar de duplicarse.

## Corrección masiva de una clase

Para justificar varias faltas sin corregir alumno por alumno:

1. Escribe `corregir lista 5A MAM 2026-09-08`.
   Si omites la fecha, usa la clase de hoy. Si hay dos materias, el bot pide elegir.
2. El bot muestra la lista numerada con el estado actual de cada alumno.
3. Responde solo por los alumnos que cambian:

   - `presentes 2,5-7` o `justificar 2,5-7`: cambian esos números a Presente.
   - `faltas 3,8`: cambian esos números a Falta.
   - `retardos 1,4`: cambian esos números a Retardo.
   - `todos` y `ninguno` también se aceptan.

Solo cambian los números indicados; los demás conservan su estado. La operación
se guarda con historial y no crea una clase nueva. Es distinta de
`pasar lista numeros`, que reemplaza las marcas de toda la clase.

## Corrección de un solo alumno por folio

Para justificantes de varias fechas de un mismo alumno:

```text
corregir alumno EDU-5AMAM-015
```

El bot muestra todas sus clases del periodo, numeradas con fecha, materia y estado.
También puedes limitar la lista:

```text
corregir EDU-5AMAM-015 2026-10-18, 2026-10-19, 2026-10-20
```

Después responde por los números de las fechas que quieres cambiar:

```text
presentes 1,3-5
justificar 1,3-5
faltas 2
retardos 7
```

Solo se modifican las fechas seleccionadas de ese alumno. La operación conserva
las demás fechas y no cambia a otros alumnos.

## Pase por números y retardos por lista

El pase individual continúa disponible. Para pasar asistencia en una sola respuesta:

1. Escribe `pasar lista numeros 5A MAM`, elige materia si corresponde y pulsa Comenzar.
2. El bot muestra los nombres, folios y estados con números, ordenados por apellidos.
3. Responde `faltas 2,6-8`. Acepta puntos y comas como separadores,
   rangos inclusivos y números repetidos sin duplicar registros.
4. Los seleccionados quedan Falta y todos los demás de la lista quedan Presente.
   Se guarda directamente, reemplazando las marcas anteriores de esa clase.
   También acepta `faltas todos` (todos con falta) y `faltas ninguno` (todos presentes).
5. Revisa el resumen y usa `finalizar lista` para cerrar.

Para corregir retardos, escribe `retardos lista 5A MAM`. Muestra a los alumnos
numerados de la clase de hoy, con sus estados actuales. Responde `retardos 6,21-22`:
solo los seleccionados cambian a Retardo. También acepta `retardos todos` y
`retardos ninguno`; ninguno no cambia marcas. Los demás conservan su estado.
`retardos lista 5A MAM 2026-09-08` permite otra fecha, incluso en listas finalizadas.
Si hay varias materias, se elige la clase. No crea una clase nueva para corregir.

Los números pertenecen a la lista mostrada; no son folios ni números de otra
revisión. Las listas omiten alumnos Dual o no activos del grupo. Conservan la
instantánea de alumnos de la clase: no agregan altas posteriores automáticamente.
`pausar lista` y `continuar lista` conservan la numeración y el tipo de revisión,
incluso al reiniciar o cambiar al módulo de tareas. `cancelar` descarta la selección
por números sin cambiar marcas. Si cambió el padrón aplicable o alguna marca desde
que se mostró la lista, se rechaza todo el lote y se debe abrir una nueva lista.
Un número inválido también rechaza el lote completo. Los cambios se guardan juntos
y se registra el estado anterior y nuevo de cada alumno en el historial.

## Almacenamiento y recuperación

`recuperar primera asistencia` propone completar las primeras clases verificadas
del periodo 2026-08 / 2027-01: 7 de septiembre para 5A CM, 5A MAM, 5B LCM,
5A PABM y 5A LCM; 8 de septiembre para 5B CM y 3A EV. Materia: energía,
excepto 5A LCM (organismos) y 3A EV (terrestre). Son fechas confirmadas para
este periodo, no una regla automática para ciclos futuros.

La fecha de alta se convierte a America/Mexico_City. Alta el mismo día significa
Presente; alta posterior, Falta. Solo agrega alumnos Activo ausentes de la lista;
conserva todas las marcas existentes, incluso Pendiente, y excluye Dual.
Muestra una propuesta y requiere Guardar; vence en 10 minutos. Si cambian los
datos antes de confirmar se rechaza. No modifica controles de revisiones abiertas.
Las nuevas listas se crean finalizadas. Repetir el comando no duplica marcas.
Cada incorporación queda registrada en Historial_Lista con su fecha de alta.

Las clases nuevas se etiquetan internamente como `P1`; las listas existentes sin
etiqueta también se consideran del primer parcial. Para la calificación, solo
cuentan las listas finalizadas. Un retardo cuenta como asistencia, pero cada tres
retardos descuentan una asistencia efectiva. Las listas abiertas se excluyen y
la calificación se muestra como preliminar hasta completarlas.

Se usan las mismas variables `SPREADSHEET_ID` y `KEY_FILE` del registro. Se crean
cuatro pestañas sin alterar `Alumnos` ni la asistencia por ubicación del bot:

- `Asistencias`: una fila por alumno y clase, con fecha, grupo, materia, folio,
  nombre, estado, hora UTC de actualización y docente.
- `Listas_Docente`: sesiones, estado y copia de la lista de alumnos al iniciar.
- `Control_Lista`: paso actual del docente, para retomar después de reiniciar.
- `Historial_Lista`: marcas, correcciones, estado anterior/nuevo, docente e ID del mensaje.

La fecha escolar usa America/Mexico_City. La hora registrada en una corrección es
la hora en que el docente la hizo, no una estimación de la hora de llegada del alumno.
Cada grupo y materia tiene una lista por fecha. Se crea una instantánea de los alumnos
al iniciar: las altas posteriores al inicio no se incorporan automáticamente a esa clase.

Las marcas y el progreso se guardan juntos en un batch de Sheets antes de responder.
Un mensaje reenviado por el webhook no vuelve a marcar al siguiente alumno; los botones
de pasos anteriores se rechazan. Si falla la respuesta, usar `continuar lista` para
recuperar el estado guardado antes de volver a marcar.

Operar una sola instancia del bot: la serialización de escrituras es por proceso.
No editar manualmente las pestañas de control ni la copia de `Asistencias`: corregir
con el bot para mantener consistentes la sesión y el historial. La configuración
se detiene si una pestaña existente tiene encabezados incompatibles.

Las pruebas usan servicios simulados: `npm test`. Tras el despliegue, verificar
una lista desde WhatsApp y comprobar las filas en Sheets. No se envían mensajes
a alumnos al pasar lista o corregirla.
