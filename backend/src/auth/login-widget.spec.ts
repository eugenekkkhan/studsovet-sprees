import { createHash, createHmac } from 'node:crypto';
import { verifyTelegramLogin } from './login-widget';

const TOKEN = '123456:TEST-TOKEN';
const signed = (overrides: Record<string, unknown> = {}) => {
  const payload = {
    id: 42,
    first_name: 'Женя',
    username: 'eugene',
    auth_date: Math.floor(Date.now() / 1000),
    ...overrides,
  };
  const check = Object.entries(payload)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHash('sha256').update(TOKEN).digest();
  return { ...payload, hash: createHmac('sha256', secret).update(check).digest('hex') };
};

describe('verifyTelegramLogin', () => {
  it('принимает свежие подписанные данные', () => {
    expect(verifyTelegramLogin(signed(), TOKEN)?.id).toBe(42);
  });

  it('отклоняет подмену и старую авторизацию', () => {
    expect(verifyTelegramLogin({ ...signed(), id: 43 }, TOKEN)).toBeNull();
    expect(verifyTelegramLogin(signed({ auth_date: 1 }), TOKEN)).toBeNull();
  });
});
