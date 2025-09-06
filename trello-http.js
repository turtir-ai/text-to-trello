import axios from 'axios';
import Bottleneck from 'bottleneck';

// General limiter: keep well under Trello token (100/10s) and key (300/10s) limits
const generalLimiter = new Bottleneck({
  reservoir: 90,
  reservoirRefreshInterval: 10_000,
  reservoirRefreshAmount: 90,
  minTime: 120,
});

// Members limiter: special route /1/members has 100 requests / 900s limit
const membersLimiter = new Bottleneck({
  reservoir: 95,
  reservoirRefreshInterval: 900_000,
  reservoirRefreshAmount: 95,
  minTime: 9_000,
});

function pickLimiter(path) {
  return path.startsWith('/1/members') ? membersLimiter : generalLimiter;
}

async function scheduleRequest(config, path) {
  const limiter = pickLimiter(path);
  return limiter.schedule(async () => {
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      // Basic retry for 429
      const status = error?.response?.status;
      if (status === 429) {
        throw new Error('Trello Rate Limit (429)');
      }
      throw error;
    }
  });
}

export async function trelloGET(path, { key, token }, params = {}) {
  const url = `https://api.trello.com${path}`;
  const config = {
    method: 'get',
    url,
    params: { key, token, ...params },
  };
  return scheduleRequest(config, path);
}

export async function trelloPOST(path, body, { key, token }, params = {}) {
  const url = `https://api.trello.com${path}`;
  const config = {
    method: 'post',
    url,
    params: { key, token, ...params },
    data: body || {},
    headers: { 'Content-Type': 'application/json' },
  };
  return scheduleRequest(config, path);
}
