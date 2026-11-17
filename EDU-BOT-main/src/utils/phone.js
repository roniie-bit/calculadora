// Acepta las dos representaciones del mismo número mexicano al verificar al docente.
export function samePhone(left, right) {
  const normalize = value => {
    const digits = String(value || '').replace(/\D/g, '');
    return /^521\d{10}$/.test(digits) ? `52${digits.slice(3)}` : digits;
  };
  const a = normalize(left);
  const b = normalize(right);
  return a !== '' && a === b;
}
// Entrada estricta: no elimina letras, extensiones ni dígitos inesperados.
export function parseStudentPhone(raw) {
  const value = String(raw ?? '').trim();
  const match = /^(?:\+?521|\+?52)?([2-9]\d{9})$/.exec(value);
  return match ? `52${match[1]}` : null;
}
