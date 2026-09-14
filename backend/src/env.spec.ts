/** Границы для чисел из окружения — на примере длительности вращения барабана. */
const loadEnv = (value: string | undefined) => {
  jest.resetModules();
  process.env.ENV_FILE = '/nonexistent/.env';
  if (value === undefined) delete process.env.FIELD_SPIN_DURATION_MS;
  else process.env.FIELD_SPIN_DURATION_MS = value;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./env') as typeof import('./env')).env;
};

describe('длительность вращения барабана из окружения', () => {
  afterAll(() => {
    delete process.env.FIELD_SPIN_DURATION_MS;
  });

  it('без переменной берёт 4200 мс', () => {
    expect(loadEnv(undefined).spinDurationMs).toBe(4200);
  });

  it('принимает заданное значение', () => {
    expect(loadEnv('8000').spinDurationMs).toBe(8000);
  });

  it('прижимает к границам, а не отключает барабан', () => {
    expect(loadEnv('0').spinDurationMs).toBe(500);
    expect(loadEnv('999999').spinDurationMs).toBe(30000);
  });

  it('на мусор откатывается к значению по умолчанию', () => {
    expect(loadEnv('быстро').spinDurationMs).toBe(4200);
    expect(loadEnv('').spinDurationMs).toBe(4200);
  });
});
