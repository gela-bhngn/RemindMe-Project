process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

test('GET /api returns a landing response', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, 'RemindMe API is running');
    assert.ok(Array.isArray(body.routes));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
