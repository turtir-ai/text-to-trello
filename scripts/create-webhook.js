#!/usr/bin/env node
import 'dotenv/config';
import axios from 'axios';

const { TRELLO_API_KEY, TRELLO_TOKEN, DEFAULT_BOARD_ID, BASE_URL } = process.env;

async function main() {
  if (!TRELLO_API_KEY || !TRELLO_TOKEN || !DEFAULT_BOARD_ID || !BASE_URL) {
    console.error('Missing env: TRELLO_API_KEY, TRELLO_TOKEN, DEFAULT_BOARD_ID, BASE_URL');
    process.exit(1);
  }
  const callbackURL = `${BASE_URL.replace(/\/$/, '')}/webhooks/trello`;
  try {
    const res = await axios.post(
      'https://api.trello.com/1/webhooks/',
      {
        description: 'text-to-trello sync',
        callbackURL,
        idModel: DEFAULT_BOARD_ID,
      },
      {
        params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    console.log('✅ Webhook created:', res.data?.id, '→', callbackURL);
  } catch (e) {
    const data = e?.response?.data || e.message;
    console.error('❌ Failed to create webhook:', data);
    process.exit(2);
  }
}

main();
