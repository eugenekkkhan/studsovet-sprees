import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { env } from '../env';
import { TelegramService } from '../telegram/telegram.service';
import { verifyInitData } from './init-data';
import { verifyTelegramLogin } from './login-widget';
import { signSession, verifySession } from './session-token';
import { displayName, type SessionResponse, type SessionUser } from './types';

/** Локальному пользователю нужен постоянный id, не пересекающийся с Telegram. */
const developerId = (name: string) => {
  const digest = createHash('sha256').update(name.toLowerCase()).digest();
  return -(digest.readUInt32BE(0) % 1_000_000_000 || 1);
};

@Injectable()
export class AuthService {
  constructor(
    private readonly telegram: TelegramService,
    private readonly database: DatabaseService,
  ) {}

  /** Что фронт должен знать до входа: как пускают и куда идти, если не пускают. */
  config() {
    return {
      requiresTelegram: env.telegramEnabled,
      devAuth: env.devAuth,
      testAuth: env.testAuthKey.length >= 32,
      miniAppUrl: env.miniAppUrl,
      ...this.telegram.describeAccess(),
    };
  }

  /** Вход из мини-приложения: подпись Telegram плюс участие в чате с ботом. */
  async loginWithInitData(initData: string): Promise<SessionResponse> {
    const verified = verifyInitData(initData, env.botToken);
    if (!verified) {
      throw new UnauthorizedException(
        'Telegram не подтвердил вход. Откройте приложение заново из чата.',
      );
    }

    return this.loginTelegramUser(verified.user);
  }

  /** Вход с обычного сайта через официальный Telegram Login Widget. */
  async loginWithWidget(payload: unknown): Promise<SessionResponse> {
    const user = verifyTelegramLogin(payload, env.botToken);
    if (!user) {
      throw new UnauthorizedException(
        'Telegram не подтвердил вход. Попробуйте авторизоваться ещё раз.',
      );
    }
    return this.loginTelegramUser(user);
  }

  private async loginTelegramUser(user: import('./types').TelegramUser) {
    const decision = await this.telegram.checkAccess(user.id);
    if (!decision.allowed) {
      throw new ForbiddenException(
        'Доступ открыт участникам чатов, где работает бот. Попросите добавить вас в чат.',
      );
    }

    return this.issue({
      id: user.id,
      name: displayName(user),
      username: user.username ?? '',
      photoUrl: user.photo_url ?? '',
      kind: 'telegram',
    });
  }

  /** Вход для разработки: без бота приложение иначе не открыть локально. */
  loginAsDeveloper(name: string): Promise<SessionResponse> {
    if (!env.devAuth) {
      throw new ForbiddenException('Вход без Telegram отключён на этом сервере.');
    }
    const safeName = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Ведущий';
    return this.issue({
      id: developerId(safeName),
      name: safeName,
      username: '',
      photoUrl: '',
      kind: 'dev',
    });
  }

  /** Тестовый пользователь доступен только по отдельному длинному ключу из env. */
  loginAsTester(key: string, name: string): Promise<SessionResponse> {
    if (env.testAuthKey.length < 32) {
      throw new ForbiddenException('Тестовый вход отключён.');
    }
    const supplied = createHash('sha256').update(String(key ?? '')).digest();
    const expected = createHash('sha256').update(env.testAuthKey).digest();
    if (!timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Неверный ключ тестового входа.');
    }
    const safeName = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Тестировщик';
    return this.issue({
      id: developerId(`test:${safeName}`),
      name: safeName,
      username: '',
      photoUrl: '',
      kind: 'dev',
    });
  }

  verify(token: string): SessionUser | null {
    const payload = verifySession(token, env.sessionSecret);
    if (!payload) return null;
    return {
      id: payload.id,
      name: payload.name,
      username: payload.username,
      photoUrl: payload.photoUrl,
      kind: payload.kind,
    };
  }

  /** Обновляет Telegram-профиль только уже импортированного участника. */
  async refreshKnownParticipant(user: SessionUser) {
    if (!this.database.enabled || user.kind !== 'telegram') return;
    await this.database.query(
      `UPDATE participants SET
         telegram_name = $2,
         username = $3,
         photo_url = $4,
         last_seen_at = now()
       WHERE user_id = $1`,
      [user.id, user.name, user.username, user.photoUrl],
    );
  }

  private async issue(user: SessionUser): Promise<SessionResponse> {
    await this.refreshKnownParticipant(user);
    const exp = Math.floor(Date.now() / 1000) + env.sessionTtlSeconds;
    return {
      token: signSession({ ...user, exp }, env.sessionSecret),
      expiresAt: exp * 1000,
      user,
    };
  }
}
