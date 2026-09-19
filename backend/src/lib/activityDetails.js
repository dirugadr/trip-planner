import ActivityPoi from '../models/ActivityPoi.js';
import Document from '../models/Document.js';
import Expense from '../models/Expense.js';

/**
 * Loads, in one query each, everything an itinerary card shows beyond the
 * activity row itself: associated POIs (HU-2.3), linked documents (HU-6.4) and
 * linked expense (HU-3.3/3.4). Returns a function that decorates an activity
 * with them. Shared by GET /api/trips/:id and the MCP day-itinerary tool so the
 * two never drift.
 */
export async function loadActivityDetails(activityIds) {
  const [poisByActivity, documentsByActivity, expenseByActivity] = await Promise.all([
    ActivityPoi.listForActivities(activityIds),
    Document.listForActivities(activityIds),
    Expense.listForActivities(activityIds)
  ]);
  return (activity) => ({
    ...activity,
    pois: poisByActivity.get(activity.id) || [],
    documents: documentsByActivity.get(activity.id) || [],
    expense: expenseByActivity.get(activity.id) || null
  });
}
