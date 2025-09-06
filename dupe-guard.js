import { trelloGET } from './trello-http.js';
import { distance } from 'fastest-levenshtein';
import crypto from 'crypto';

const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();

export async function findPossibleDuplicate({ boardId, title, due, key, token }) {
  try {
    const core = title.split(' ').slice(0, 6).join(' ');
    const q = encodeURIComponent(`"${core}"`);
    const res = await trelloGET(
      `/1/search?query=${q}&idBoards=${boardId}&modelTypes=cards&cards_limit=20&card_fields=name,due,url`,
      { key, token }
    );
    const t = norm(title);
    for (const c of res.cards || []) {
      const close = distance(t, norm(c.name || '')) <= 2;
      const sameDay = !due || !c.due || c.due.slice(0, 10) === (due || '').slice(0, 10);
      if (close && sameDay) return { id: c.id, url: c.url, isDuplicate: true };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export const idemKey = (boardId, listId, title, due) =>
  crypto
    .createHash('sha1')
    .update(`${boardId}|${listId}|${norm(title)}|${(due || '').slice(0, 10)}`)
    .digest('hex');
