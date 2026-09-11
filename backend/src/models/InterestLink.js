import { randomUUID } from 'crypto';
import { findById, dbAll, dbBatch, deleteOne } from '../db/database.js';
import Tag from './Tag.js';

const TABLE = 'interest_links';
const BRIDGE = 'interest_link_tags';

async function attachTags(links) {
  if (links.length === 0) return [];
  const placeholders = links.map(() => '?').join(', ');
  const tagRows = await dbAll(
    `SELECT ilt.interest_link_id, t.id, t.name
       FROM ${BRIDGE} ilt
       JOIN tags t ON t.id = ilt.tag_id
      WHERE ilt.interest_link_id IN (${placeholders})
      ORDER BY t.name ASC`,
    links.map((l) => l.id)
  );
  const byLink = {};
  for (const r of tagRows) {
    (byLink[r.interest_link_id] ??= []).push({ id: r.id, name: r.name });
  }
  return links.map((l) => ({ ...l, tags: byLink[l.id] || [] }));
}

export class InterestLink {
  static async create({ trip_id, title, url, tagNames = [] }) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const tags = await Tag.resolveMany(trip_id, tagNames);

    await dbBatch([
      {
        sql: `INSERT INTO ${TABLE} (id, trip_id, title, url, created_at, updated_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        args: [id, trip_id, title, url, now, now],
      },
      ...tags.map((t) => ({
        sql: `INSERT INTO ${BRIDGE} (interest_link_id, tag_id) VALUES (?, ?)`,
        args: [id, t.id],
      })),
    ]);

    return InterestLink.findById(id);
  }

  static async findById(id) {
    const link = await findById(TABLE, id);
    if (!link) return null;
    const [withTags] = await attachTags([link]);
    return withTags;
  }

  /** Trip's links, newest first. `tagNames`, if given, ORs the filter (at least one match). */
  static async findByTripId(tripId, tagNames = null) {
    const clean = (tagNames || []).map(Tag.normalize).filter(Boolean);

    let sql = `SELECT DISTINCT il.* FROM ${TABLE} il`;
    const args = [];
    if (clean.length > 0) {
      sql += ` JOIN ${BRIDGE} ilt ON ilt.interest_link_id = il.id
               JOIN tags t ON t.id = ilt.tag_id AND t.name IN (${clean.map(() => '?').join(', ')})`;
      args.push(...clean);
    }
    sql += ` WHERE il.trip_id = ? AND il.deleted_at IS NULL ORDER BY il.created_at DESC`;
    args.push(tripId);

    const links = await dbAll(sql, args);
    return attachTags(links);
  }

  static async update(id, { title, url, tagNames = [] }) {
    const link = await findById(TABLE, id);
    if (!link) return null;

    const now = new Date().toISOString();
    const tags = await Tag.resolveMany(link.trip_id, tagNames);

    await dbBatch([
      {
        sql: `UPDATE ${TABLE} SET title = ?, url = ?, updated_at = ? WHERE id = ?`,
        args: [title, url, now, id],
      },
      { sql: `DELETE FROM ${BRIDGE} WHERE interest_link_id = ?`, args: [id] },
      ...tags.map((t) => ({
        sql: `INSERT INTO ${BRIDGE} (interest_link_id, tag_id) VALUES (?, ?)`,
        args: [id, t.id],
      })),
    ]);

    return InterestLink.findById(id);
  }

  /** Soft delete the link. Tags themselves are left untouched, for reuse. */
  static delete(id) {
    return deleteOne(TABLE, id, true);
  }
}

export default InterestLink;
