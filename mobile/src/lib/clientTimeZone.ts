export function appendClientTimeZone(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
  if (timeZone) next.set('timeZone', timeZone);
  next.set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));
  return next;
}
