import LRU from 'lru-cache';
import { trelloGET } from './trello-http.js';

const cache = new LRU({ max: 120, ttl: 10 * 60 * 1000 }); // 10 minutes

export async function getBoardMembers({ boardId, key, token }) {
  const k = `members:${boardId}`;
  if (cache.has(k)) return cache.get(k);
  const data = await trelloGET(`/1/boards/${boardId}/members`, { key, token });
  cache.set(k, data);
  return data;
}

export async function getBoardLabels({ boardId, key, token }) {
  const k = `labels:${boardId}`;
  if (cache.has(k)) return cache.get(k);
  const data = await trelloGET(`/1/boards/${boardId}/labels`, { key, token });
  cache.set(k, data);
  return data;
}
