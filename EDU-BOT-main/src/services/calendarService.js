import { google } from 'googleapis';
import path from 'path';
import dateFnsTz from "date-fns-tz";
const { zonedTimeToUtc, utcToZonedTime } = dateFnsTz;

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_FILE = path.join(process.cwd(), 'src/credentials/calendar.json');

// Calendario donde se agendan citas
const calendarId = 'ferraez.js@gmail.com';

// Zona horaria
const TIME_ZONE = process.env.TIME_ZONE || "America/Mexico_City";

/* ======================================================
   AUTENTICACIÓN GOOGLE CALENDAR
====================================================== */
export async function getCalendarService() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_FILE,
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();
  return google.calendar({ version: 'v3', auth: authClient });
}

/* ======================================================
   PARSER DE HORARIOS
====================================================== */
export function parseUserHour(userInput) {
  const mapping = {
    '11': '11:30',
    '11:30': '11:30',
    '12': '12:00',
    '12:00': '12:00',
    '12:30': '12:30',
    '13': '13:00',
    '13:00': '13:00',
    '13:30': '13:30',

    '16': '16:00',
    '16:00': '16:00',
    '16:30': '16:30',
    '17': '17:00',
    '17:00': '17:00',
    '17:30': '17:30',
    '18': '18:00',
    '18:00': '18:00',
    '18:30': '18:30',
    '19': '19:00',
    '19:00': '19:00'
  };

  return mapping[userInput.trim().toLowerCase()] || null;
}

/* ======================================================
   OBTENER EVENTOS DEL DÍA (FILTRADO LOCAL)
====================================================== */
export async function getEventsForDay(service, dateObj) {

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  const dateString = `${year}-${month}-${day}`;

  const startLocal = `${dateString} 00:00:00`;
  const endLocal   = `${dateString} 23:59:59`;

  const startOfDayUTC = zonedTimeToUtc(startLocal, TIME_ZONE);
  const endOfDayUTC   = zonedTimeToUtc(endLocal, TIME_ZONE);

  const res = await service.events.list({
    calendarId,
    timeMin: startOfDayUTC.toISOString(),
    timeMax: endOfDayUTC.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

/* ======================================================
   CREAR EVENTO
====================================================== */
export async function createCalendarEvent(dateObj, chosenTime, userNumber) {
  const service = await getCalendarService();

  const [h, m] = chosenTime.split(':');
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  const dateTimeString = `${year}-${month}-${day} ${h}:${m}:00`;

  // Convertimos la fecha local a UTC (Google Calendar trabaja mejor así)
  const eventStart = zonedTimeToUtc(dateTimeString, TIME_ZONE);
  const eventEnd = new Date(eventStart.getTime() + 30 * 60000);

  const event = {
    summary: `Cita agendada`,  // ← SIMPLE, LIMPIO
    description: `Número del alumno: ${userNumber}`,
    start: {
      dateTime: eventStart.toISOString(),
    },
    end: {
      dateTime: eventEnd.toISOString(),
    }
  };

  const result = await service.events.insert({
    calendarId,
    resource: event
  });

  return result.data;
}

/* ======================================================
   ACTUALIZAR EVENTO → AÑADIR NOMBRE
====================================================== */
export async function updateCalendarEvent(eventId, patientName) {
  const service = await getCalendarService();

  const resource = {
    summary: `Cita – ${patientName}`,  // ← NOMBRE EN EL TÍTULO
    description: `Nombre del alumno: ${patientName}. Evento creado automáticamente por EDU-BOT.`
  };

  const result = await service.events.patch({
    calendarId,
    eventId,
    resource
  });

  return result.data;
}
