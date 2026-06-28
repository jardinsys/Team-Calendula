const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('mongoose', () => {
  const original = jest.requireActual('mongoose');
  return {
    ...original,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: {
      close: jest.fn().mockResolvedValue(undefined),
      ...(original.connection || {}),
    },
    ...(original.default || original),
  };
});

describe('API route mounts', () => {
  let app;
  const expectedRoutes = [
    '/health',
    '/api/health',
    '/api/auth/discord',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/auth/activity/token',
    '/api/auth/activity/exchange',
    '/api/import/preview',
  ];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chameleon_test';
    jest.isolateModules(() => {
      app = require('./api');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('responding known route returns not auth/404 where a handler should exist', async () => {
    for (const route of expectedRoutes) {
      const res = await request(app)
        .options(route)
        .set('Accept', 'application/json')
        .timeout(5000);

      const handled = res.status !== 404;
      if (!handled) {
        console.log(`Unmounted route: ${route}`);
      }
      expect(handled).toBe(true);
    }
  });
});
