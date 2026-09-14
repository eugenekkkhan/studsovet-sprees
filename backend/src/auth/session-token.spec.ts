import { signSession, verifySession } from './session-token';
import type { SessionPayload } from './types';

const payload: SessionPayload = {
  id: 42,
  name: 'Женя',
  username: 'eugene',
  photoUrl: '',
  kind: 'telegram',
  exp: Math.floor(Date.now() / 1000) + 60,
};

describe('подпись сессии', () => {
  it('читает свой токен обратно', () => {
    const token = signSession(payload, 'секрет');
    expect(verifySession(token, 'секрет')).toEqual(payload);
  });

  it('не верит чужому ключу и правленому телу', () => {
    const token = signSession(payload, 'секрет');
    expect(verifySession(token, 'другой')).toBeNull();

    const [, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, id: 1 })).toString(
      'base64url',
    );
    expect(verifySession(`${forged}.${signature}`, 'секрет')).toBeNull();
  });

  it('не принимает просроченный токен', () => {
    const expired = signSession(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 1 },
      'секрет',
    );
    expect(verifySession(expired, 'секрет')).toBeNull();
  });

  it('не падает на мусоре', () => {
    expect(verifySession('', 'секрет')).toBeNull();
    expect(verifySession('однасекция', 'секрет')).toBeNull();
    expect(verifySession('a.b', 'секрет')).toBeNull();
  });
});
