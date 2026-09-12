/**
 * Client-side mirror of the backend's Activity.js findScheduleConflicts
 * (HU-1.8 semantics: tentative plans and items without a time+duration don't
 * count). The itinerary already has every field this needs in `trip.days`,
 * so this avoids an extra request just to show the same banner the create/
 * edit form already computes server-side.
 */

/** "HH:MM" -> minutes since midnight, or null. */
export function parseHM(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hm ?? '').toString().trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

export function findScheduleConflicts(items) {
  const timed = items
    .filter((i) => !i.tentative && i.start_time && i.duration_minutes)
    .map((i) => ({ id: i.id, title: i.title, start: parseHM(i.start_time), dur: i.duration_minutes }))
    .filter((i) => i.start != null);

  const out = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const x = timed[i];
      const y = timed[j];
      if (rangesOverlap(x.start, x.start + x.dur, y.start, y.start + y.dur)) {
        out.push({ a: { id: x.id, title: x.title }, b: { id: y.id, title: y.title } });
      }
    }
  }
  return out;
}
