import { Logger } from '@nestjs/common';
import { fetch as directFetch, ProxyAgent, type Dispatcher } from 'undici';
import { env } from '../env';

interface ApiEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

/** Тонкая обёртка над Bot API: один метод, никаких зависимостей. */
export class TelegramApi {
  private readonly logger = new Logger('TelegramApi');
  private readonly dispatcher: Dispatcher | undefined;

  constructor(private readonly token: string) {
    if (env.telegramProxyUrl) {
      this.dispatcher = new ProxyAgent(env.telegramProxyUrl);
    }
  }

  get enabled() {
    return this.token !== '';
  }

  async call<T>(
    method: string,
    payload: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const url = `https://api.telegram.org/bot${this.token}/${method}`;
      const options = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      };
      const response = await directFetch(url, {
        ...options,
        dispatcher: this.dispatcher,
      });
      const envelope = (await response.json()) as ApiEnvelope<T>;
      if (!envelope.ok) {
        // Ошибки вроде «бот не в чате» — рабочая ситуация, а не сбой.
        this.logger.debug(`${method}: ${envelope.description ?? 'отказ Telegram'}`);
        return null;
      }
      return envelope.result ?? null;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return null;
      // Ошибки HTTP-клиентов часто содержат полный URL, а в Bot API URL входит
      // токен. Не выводим message/cause: в логах достаточно класса ошибки.
      const kind = error instanceof Error ? error.name : 'NetworkError';
      this.logger.warn(`${method}: нет связи с Telegram (${kind})`);
      return null;
    }
  }
}
