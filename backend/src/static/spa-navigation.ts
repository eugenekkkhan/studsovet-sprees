/**
 * Перезагрузка клиентского маршрута приходит как запрос HTML без заголовка
 * авторизации. API-fetch обычно принимает JSON или любой тип, поэтому проверяем
 * явный `text/html`, а не размытый `request.accepts('html')`.
 */
export const isSpaNavigation = (method: string, accept = '') =>
  method.toUpperCase() === 'GET' && /(?:^|,)\s*text\/html(?:\s*;|\s*,|\s*$)/i.test(accept);
