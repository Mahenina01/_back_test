import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMockResponse } from './mockApi';

const storage = new Map();
const localStorageMock = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mock authentication', () => {
  it('registers an account and allows it to sign in again', async () => {
    const body = JSON.stringify({
      full_name: 'Demo User',
      email: 'demo@example.com',
      password: 'secure-demo-password',
    });

    await getMockResponse('/auth/register', { method: 'POST', body });
    const storedUsers = JSON.parse(localStorageMock.getItem('smart_incubator_demo_users'));
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0].passwordHash).toBeTruthy();
    expect(storedUsers[0]).not.toHaveProperty('password');

    const response = await getMockResponse('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'DEMO@example.com', password: 'secure-demo-password' }),
    });
    expect(response.user.email).toBe('demo@example.com');
  });

  it('rejects duplicate demo account emails', async () => {
    const body = JSON.stringify({
      full_name: 'Demo User',
      email: 'admin@smartincubator.com',
      password: 'secure-demo-password',
    });

    await expect(getMockResponse('/auth/register', { method: 'POST', body }))
      .rejects.toThrow('Un compte de démonstration existe déjà');
  });

  it('keeps the built-in demo login available', async () => {
    const response = await getMockResponse('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@smartincubator.com', password: 'admin123' }),
    });
    expect(response.user.name).toBe('Admin');
  });
});
