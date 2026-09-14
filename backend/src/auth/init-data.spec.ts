import { createHmac } from 'node:crypto';
import { verifyInitData } from './init-data';

const BOT_TOKEN = '123456:TEST-TOKEN';

const buildInitData = (
  fields: Record<string, string>,
  token = BOT_TOKEN,
): string => {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
};

const authDate = String(Math.floor(Date.now() / 1000));
const user = JSON.stringify({ id: 7, first_name: 'Женя', username: 'eugene' });

describe('verifyInitData', () => {
  it('принимает подписанные ботом данные', () => {
    const result = verifyInitData(
      buildInitData({ auth_date: authDate, user, start_param: 'quiz_ABCD' }),
      BOT_TOKEN,
    );

    expect(result?.user.id).toBe(7);
    expect(result?.startParam).toBe('quiz_ABCD');
  });

  it('учитывает новое поле signature при проверке hash', () => {
    const result = verifyInitData(
      buildInitData({
        auth_date: authDate,
        user,
        signature: 'telegram-ed25519-signature',
      }),
      BOT_TOKEN,
    );

    expect(result?.user.id).toBe(7);
  });

  it('отклоняет подпись чужого бота', () => {
    const foreign = buildInitData({ auth_date: authDate, user }, '999:OTHER');
    expect(verifyInitData(foreign, BOT_TOKEN)).toBeNull();
  });

  it('отклоняет подменённое поле', () => {
    const raw = buildInitData({ auth_date: authDate, user });
    const tampered = raw.replace(
      encodeURIComponent(user),
      encodeURIComponent(JSON.stringify({ id: 8, first_name: 'Чужой' })),
    );
    expect(verifyInitData(tampered, BOT_TOKEN)).toBeNull();
  });

  it('отклоняет просроченную подпись', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const raw = buildInitData({ auth_date: old, user });
    expect(verifyInitData(raw, BOT_TOKEN, 60)).toBeNull();
    expect(verifyInitData(raw, BOT_TOKEN, 7200)?.user.id).toBe(7);
  });

  it('не падает на пустой строке и мусоре', () => {
    expect(verifyInitData('', BOT_TOKEN)).toBeNull();
    expect(verifyInitData('hash=zz', BOT_TOKEN)).toBeNull();
    expect(verifyInitData(buildInitData({ auth_date: authDate }), BOT_TOKEN)).toBeNull();
  });
});
