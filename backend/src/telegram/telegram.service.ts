import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { env } from '../env';
import { ChatRegistry, type AllowedChat } from './chat-registry';
import { TelegramApi } from './telegram-api';

interface ChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  is_member?: boolean;
}

/** Кто считается участником чата: «ограниченный» — тоже участник, пока не вышел. */
const isInside = (member: ChatMember | null) => {
  if (!member) return false;
  if (member.status === 'restricted') return member.is_member !== false;
  return ['creator', 'administrator', 'member'].includes(member.status);
};

/** Сколько держим ответ Telegram: чтобы не дёргать API на каждом открытии. */
const CACHE_MS = 5 * 60 * 1000;
const DENY_CACHE_MS = 60 * 1000;

export interface AccessDecision {
  allowed: boolean;
  chat?: AllowedChat;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger('Telegram');
  readonly api = new TelegramApi(env.botToken);
  readonly chats = new ChatRegistry();
  private readonly decisions = new Map<number, { allowed: boolean; until: number }>();
  private botUsername = '';

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN не задан — вход в приложение открыт всем (режим разработки).',
      );
      return;
    }
    const me = await this.api.call<{ username?: string }>('getMe');
    if (!me) {
      this.logger.error(
        'Telegram не принял TELEGRAM_BOT_TOKEN — в приложение никто не войдёт.',
      );
      return;
    }
    this.botUsername = me.username ?? '';
    this.logger.log(
      `Бот @${this.botUsername} на связи; чатов с доступом: ${this.chats.list().length}.`,
    );
  }

  get enabled() {
    return env.telegramEnabled;
  }

  get username() {
    if (this.botUsername) return this.botUsername;
    // Даже если getMe был недоступен при старте, имя уже есть в ссылке Mini App.
    // Это позволяет показать Telegram Login Widget и сформировать ссылку на бота.
    const match = /^https:\/\/t\.me\/([^/?#]+)/i.exec(env.miniAppUrl);
    return match?.[1] ?? '';
  }

  /** Доступ есть у администраторов из настроек и у участников известных чатов. */
  async checkAccess(userId: number): Promise<AccessDecision> {
    if (!this.enabled) return { allowed: true };
    if (env.adminIds.includes(userId)) return { allowed: true };

    const cached = this.decisions.get(userId);
    if (cached && cached.until > Date.now()) {
      return { allowed: cached.allowed };
    }

    for (const chat of this.chats.list()) {
      const member = await this.api.call<ChatMember>('getChatMember', {
        chat_id: chat.id,
        user_id: userId,
      });
      if (isInside(member)) {
        this.remember(userId, true);
        return { allowed: true, chat };
      }
    }

    this.remember(userId, false);
    return { allowed: false };
  }

  /** Пользователь вышел или его добавили в чат — старый ответ больше не годится. */
  forgetDecision(userId: number) {
    this.decisions.delete(userId);
  }

  /** Публичное описание доступа: показываем на экране входа. */
  describeAccess() {
    return {
      chats: this.chats.list().map(({ id, title }) => ({ id, title })),
      botUsername: this.username,
    };
  }

  private remember(userId: number, allowed: boolean) {
    this.decisions.set(userId, {
      allowed,
      until: Date.now() + (allowed ? CACHE_MS : DENY_CACHE_MS),
    });
  }
}
