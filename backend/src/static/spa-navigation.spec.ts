import { isSpaNavigation } from './spa-navigation';

describe('isSpaNavigation', () => {
  it('recognises browser refreshes of client routes', () => {
    expect(isSpaNavigation('GET', 'text/html,application/xhtml+xml')).toBe(true);
    expect(isSpaNavigation('get', 'text/html; charset=utf-8')).toBe(true);
  });

  it('does not intercept API requests or mutations', () => {
    expect(isSpaNavigation('GET', 'application/json')).toBe(false);
    expect(isSpaNavigation('GET', '*/*')).toBe(false);
    expect(isSpaNavigation('POST', 'text/html')).toBe(false);
  });
});
