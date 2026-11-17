# Encuesta SNCyT 2026

## Activación

Enviar al bot:

`SNCyT26`

Durante la prueba también se acepta `SNCyT26DEMO`. Para separar las
conferencias se pueden usar `SNCyT26AM` y `SNCyT26PM`.

El bot mostrará diez preguntas, una por mensaje. Las respuestas se escriben con
el número de la opción. En la pregunta 7 se pueden elegir varias opciones con
números separados por coma, por ejemplo `1, 3, 4`.

Comandos disponibles durante la prueba:

- `CANCELAR`: abandona la encuesta en curso.
- `REINTENTAR`: intenta guardar otra vez si falló Google Sheets.

## Destino

El bot crea automáticamente la pestaña `SNCyT_2026` en el libro temporal
configurado con `SALES_SPREADSHEET_ID` y `SALES_KEY_FILE`.

La pestaña contiene una fila por respuesta completa, con 19 columnas. La
selección múltiple de comunicación se convierte en columnas independientes con
valores `1` o `0`.

No se guardan nombres, teléfonos ni mensajes libres.

## Validación

Pruebas automatizadas:

```text
node --test test/sncytSurvey.test.js
```

La prueba funcional requiere que `SALES_SPREADSHEET_ID` y `SALES_KEY_FILE`
apunten al libro temporal y que la cuenta de servicio tenga permiso de edición.
