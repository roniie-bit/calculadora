# Reporte de calificaciones del primer parcial

El administrador puede recalcular todas las calificaciones y actualizar una
pestaña consolidada con:

```text
procesar calificaciones
```

También se aceptan `generar calificaciones` y `actualizar calificaciones`.
Para limitar el proceso a un grupo:

```text
procesar calificaciones 5A MAM
```

El bot crea o reescribe automáticamente la pestaña:

**Calificaciones_Primer_Parcial**

No se debe editar manualmente. Cada ejecución del comando vuelve a leer tareas,
asistencias y exámenes sincronizados, y reemplaza el contenido de la pestaña con
el estado más reciente.

## Fórmula

| Componente | Peso | Cálculo |
| --- | ---: | --- |
| Tareas | 40% | puntos obtenidos / puntos posibles de tareas revisadas × 40 |
| Asistencia | 30% | asistencia efectiva / clases finalizadas × 30 |
| Examen | 30% | Primer parcial / 10 × 30 |
| Total | 100% | suma de los tres componentes |

Un retardo cuenta como asistencia. Cada tres retardos acumulados descuentan una
asistencia efectiva. Las tareas `Sin revisar`, las listas abiertas y las clases
sin marcar se excluyen. Si existe algún pendiente, el estado de la fila es
`Preliminar`; si todo está cerrado, es `Completa`.

## Columnas de la pestaña

| Columna | Contenido |
| --- | --- |
| Grupo | Grupo del alumno. |
| Materia | Materia calculada. |
| Periodo | Periodo escolar. |
| Folio | Identificador del alumno. |
| Nombre alumno | Nombre del registro. |
| Estado alumno | Activo o Dual. |
| Tareas 40 | Aporte de tareas. |
| Asistencia 30 | Aporte de asistencia. |
| Examen 30 | Aporte del primer parcial. |
| Total 100 | Suma de los tres componentes. |
| Total 10 | Equivalente sobre 10. |
| Tareas revisadas | Cantidad usada en el cálculo. |
| Tareas pendientes | Cantidad excluida por no estar revisada. |
| Puntos tarea | Puntos obtenidos. |
| Tarea posible | Suma de valores de tareas revisadas. |
| Clases consideradas | Clases finalizadas incluidas. |
| Presentes | Conteo de asistencias. |
| Retardos | Conteo de retardos. |
| Faltas | Conteo de faltas. |
| Asistencia efectiva | Clases consideradas menos faltas y grupos de tres retardos. |
| Examen P1 | Calificación del primer parcial sobre 10. |
| Estado | Completa o Preliminar. |
| Pendientes | Datos que impiden cerrar la calificación. |
| Actualización UTC | Momento en que se ejecutó el proceso. |

Los alumnos se ordenan por grupo, materia y nombre. Los grupos con dos materias
generan dos filas por alumno. El segundo parcial todavía no se incluye en este
cálculo.

## Flujo recomendado

1. Crear y revisar tareas.
2. Pasar lista y finalizar las clases.
3. Crear, editar y sincronizar los exámenes.
4. Enviar `procesar calificaciones`.
5. Revisar la pestaña generada.

Si posteriormente cambia una tarea, una asistencia o un examen, vuelve a enviar
el comando. El reporte se recalcula completo.
