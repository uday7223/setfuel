import type { Request } from 'express';

type ClientTimeZone =
  | { mode: 'iana'; value: string }
  | { mode: 'offset'; value: number };

const TIME_ZONE_RE = /^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)*$/;
const MAX_OFFSET_MINUTES = 14 * 60;

export function getClientTimeZone(req: Request): ClientTimeZone {
  const rawTimeZone = typeof req.query.timeZone === 'string' ? req.query.timeZone.trim() : '';
  if (rawTimeZone && TIME_ZONE_RE.test(rawTimeZone)) {
    return { mode: 'iana', value: rawTimeZone };
  }

  const rawOffset =
    typeof req.query.tzOffsetMinutes === 'string' ? Number(req.query.tzOffsetMinutes) : NaN;
  const offsetMinutes =
    Number.isInteger(rawOffset) &&
    rawOffset >= -MAX_OFFSET_MINUTES &&
    rawOffset <= MAX_OFFSET_MINUTES
      ? rawOffset
      : 0;

  return { mode: 'offset', value: offsetMinutes };
}

export function getLocalDateExpr(
  timestampExpr: string,
  timeZone: ClientTimeZone,
  paramIndex: number,
): string {
  if (timeZone.mode === 'iana') {
    return `((${timestampExpr}) AT TIME ZONE $${paramIndex})::date`;
  }
  return `(((${timestampExpr}) AT TIME ZONE 'UTC') - ($${paramIndex}::int * INTERVAL '1 minute'))::date`;
}

export function getClientTimeZoneParam(timeZone: ClientTimeZone): string | number {
  return timeZone.value;
}
