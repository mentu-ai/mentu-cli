import { beforeAll, afterAll } from 'vitest';

export const TEST_TIMEOUT = 10000;

beforeAll(() => {
  process.env.MENTU_ACTOR = 'test-runner';
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup
});
