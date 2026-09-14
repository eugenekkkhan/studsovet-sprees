import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import type { SessionUser } from '../auth/types';
import { env } from '../env';
import { EventsService } from '../events/events.service';
import type { RsvpStatus } from '../events/types';
import { TelegramService } from './telegram.service';

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: TelegramChat;
    from?: { id: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean };
    text?: string;
  };
  message_reaction?: {
    chat: TelegramChat;
    message_id: number;
    date: number;
    user?: { id: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean };
    new_reaction: unknown[];
  };
  my_chat_member?: {
    chat: TelegramChat;
    new_chat_member: { status: string };
  };
  chat_member?: {
    chat: TelegramChat;
    new_chat_member: {
      user: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        is_bot?: boolean;
      };
      status: string;
      is_member?: boolean;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    data?: string;
    message?: { chat: TelegramChat };
  };
}

const GROUPS = ['group', 'supergroup', 'channel'];
const INSIDE = ['creator', 'administrator', 'member', 'restricted'];

/** Команда без учёта регистра и суффикса `@имя_бота`. */
const commandOf = (text: string) =>
  text.trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase() ?? '';

/**
 * Живёт на long polling: публичный адрес нужен мини-приложению, а боту хватает
 * исходящего соединения. Второй процесс с тем же токеном обновления не получит,
 * поэтому опрос выключается переменной TELEGRAM_POLLING.
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TelegramBot');
  private readonly controller = new AbortController();
  private offset = 0;
  private running = false;
  private readonly pendingDeclineReasons = new Map<number, string>();

  constructor(
    private readonly telegram: TelegramService,
    private readonly events: EventsService,
    private readonly activity: ActivityService,
  ) {}

  onModuleInit() {
    if (!this.telegram.enabled || !env.polling) return;
    this.running = true;
    void this.poll();
  }

  onModuleDestroy() {
    this.running = false;
    this.controller.abort();
  }

  private async poll() {
    this.logger.log('Слушаем сообщения бота.');
    while (this.running) {
      const updates = await this.telegram.api.call<TelegramUpdate[]>(
        'getUpdates',
        {
          offset: this.offset,
          timeout: 30,
          allowed_updates: [
            'message', 'message_reaction', 'my_chat_member', 'chat_member', 'callback_query',
          ],
        },
        this.controller.signal,
      );

      if (!this.running) return;
      if (!updates) {
        // Сеть отвалилась или Telegram ответил отказом — не забиваем его повторами.
        await this.pause(3000);
        continue;
      }

      for (const update of updates) {
        let handled = false;
        for (let attempt = 1; attempt <= 3 && !handled; attempt += 1) {
          try {
            await this.handle(update);
            handled = true;
          } catch (error) {
            this.logger.warn(
              `Не смогли обработать update ${update.update_id}, попытка ${attempt}/3: ${String(error)}`,
            );
            if (attempt < 3) await this.pause(500 * attempt);
          }
        }
        // Offset двигается только после обработки или трёх явно
        // зафиксированных неудач. Одиночный сбой БД больше не теряет update.
        if (!handled) {
          this.logger.error(`Update ${update.update_id} пропущен после трёх попыток.`);
        }
        this.offset = Math.max(this.offset, update.update_id + 1);
      }
    }
  }

  private async handle(update: TelegramUpdate) {
    if (update.callback_query) {
      await this.onCallback(update.callback_query);
      return;
    }
    const reaction = update.message_reaction;
    if (
      reaction?.user &&
      !reaction.user.is_bot &&
      GROUPS.includes(reaction.chat.type) &&
      this.telegram.chats.has(reaction.chat.id)
    ) {
      await this.activity.recordReaction(
        reaction.chat.id,
        reaction.message_id,
        reaction.date,
        reaction.user,
        reaction.new_reaction.length,
      );
      return;
    }
    const membership = update.my_chat_member;
    if (membership && GROUPS.includes(membership.chat.type)) {
      await this.onBotMembershipChanged(membership.chat, membership.new_chat_member.status);
      return;
    }

    // Состав чата поменялся — прошлый ответ о доступе больше не действителен.
    if (update.chat_member && this.telegram.chats.has(update.chat_member.chat.id)) {
      const member = update.chat_member.new_chat_member;
      this.telegram.forgetDecision(member.user.id);
      if (!member.user.is_bot && GROUPS.includes(update.chat_member.chat.type)) {
        await this.activity.recordMembership(
          update.chat_member.chat,
          member.user,
          member.status === 'restricted' && member.is_member === false
            ? 'left'
            : member.status,
        );
      }
      return;
    }

    const message = update.message;
    if (
      message &&
      GROUPS.includes(message.chat.type) &&
      !this.telegram.chats.has(message.chat.id)
    ) {
      return;
    }
    if (
      message?.from &&
      !message.from.is_bot &&
      GROUPS.includes(message.chat.type)
    ) {
      await this.activity.recordMessage(
        message.chat.id,
        message.message_id,
        message.date,
        message.from,
      );
    }
    if (!message?.text) return;
    if (
      message.chat.type === 'private' &&
      message.from?.id &&
      !message.text.trim().startsWith('/')
    ) {
      const eventId = this.pendingDeclineReasons.get(message.from.id);
      if (eventId) {
        this.pendingDeclineReasons.delete(message.from.id);
        this.events.rsvp(
          this.sessionUser(message.from),
          eventId,
          'declined',
          message.text,
        );
        await this.send(message.chat, 'Причина сохранена. Спасибо, что предупредили.');
        return;
      }
    }
    await this.onCommand(message.chat, commandOf(message.text), message.from?.id);
  }

  private async onCallback(callback: NonNullable<TelegramUpdate['callback_query']>) {
    const match = /^event:([0-9a-f-]{36}):(going|declined|maybe)$/.exec(
      callback.data ?? '',
    );
    if (!match) return;
    const [, eventId, rawStatus] = match;
    const status = rawStatus as RsvpStatus;
    const event = this.events.getPublished(eventId);
    if (!event) {
      await this.answerCallback(callback.id, 'Мероприятие уже закрыто.', true);
      return;
    }

    try {
      this.events.rsvp(this.sessionUser(callback.from), eventId, status, '');
      const labels = { going: 'Вы записались.', declined: 'Вы отказались.', maybe: 'Ответ «Пока думаю» сохранён.' };
      if (status === 'declined') {
        this.pendingDeclineReasons.set(callback.from.id, eventId);
        const delivered = await this.telegram.api.call('sendMessage', {
          chat_id: callback.from.id,
          text: `Почему вы не сможете прийти на «${event.title}»? Ответьте одним сообщением.`,
        });
        if (!delivered) {
          this.pendingDeclineReasons.delete(callback.from.id);
          await this.answerCallback(
            callback.id,
            'Отказ сохранён. Причину можно указать в приложении.',
          );
          return;
        }
      }
      await this.answerCallback(
        callback.id,
        status === 'declined' ? 'Отказ сохранён. Напишите причину боту в личке.' : labels[status],
      );
    } catch {
      await this.answerCallback(callback.id, 'Не удалось сохранить ответ.', true);
    }
  }

  private sessionUser(user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  }): SessionUser {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return {
      id: user.id,
      name: name || (user.username ? `@${user.username}` : `id${user.id}`),
      username: user.username ?? '',
      photoUrl: '',
      kind: 'telegram',
    };
  }

  private async answerCallback(id: string, text: string, showAlert = false) {
    await this.telegram.api.call('answerCallbackQuery', {
      callback_query_id: id,
      text,
      show_alert: showAlert,
    });
  }

  private async onBotMembershipChanged(chat: TelegramChat, status: string) {
    if (INSIDE.includes(status)) {
      if (!this.telegram.chats.has(chat.id)) {
        this.logger.log(`Чат «${chat.title ?? chat.id}» не входит в экосистему — игнорируем.`);
        return;
      }
      const remembered = this.telegram.chats.remember(chat);
      this.logger.log(`Бота добавили в «${remembered.title}» (${chat.id}).`);
      return;
    }

    this.logger.log(`Бота убрали из чата ${chat.id}; чат остаётся в списке экосистемы.`);
  }

  private async onCommand(chat: TelegramChat, command: string, userId?: number) {
    if (command === '/id') {
      await this.send(chat, `Идентификатор этого чата: <code>${chat.id}</code>`);
      return;
    }

    if (!['/start', '/app', '/help'].includes(command)) return;

    if (chat.type === 'private') {
      const decision = userId
        ? await this.telegram.checkAccess(userId)
        : { allowed: false };
      await this.send(
        chat,
        decision.allowed
          ? 'Открывайте приложение — колоды хранятся за вами и подтянутся на любом устройстве.'
          : [
              'Доступ выдаётся по чату: попросите добавить бота в ваш чат',
              'или добавьте его сами и напишите там /app.',
            ].join(' '),
        decision.allowed,
      );
      return;
    }

    this.telegram.chats.remember(chat);
    await this.send(chat, 'Приложение для игр этого чата:', true);
  }

  private async send(chat: TelegramChat, text: string, withButton = false) {
    await this.telegram.api.call('sendMessage', {
      chat_id: chat.id,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(withButton ? this.keyboard(chat.type) : {}),
    });
  }

  /**
   * Кнопка `web_app` работает только в личке. В группе нужна ссылка вида
   * `t.me/бот/приложение` — её и настраивают в MINI_APP_URL, если мини-приложение
   * заведено через BotFather.
   */
  private keyboard(chatType: TelegramChat['type']) {
    const url = env.miniAppUrl;
    if (!url) return {};

    const direct = /^https:\/\/t\.me\//i.test(url);
    const button =
      direct || chatType !== 'private'
        ? {
            text: 'Открыть приложение',
            url: direct ? url : `https://t.me/${this.telegram.username}`,
          }
        : { text: 'Открыть приложение', web_app: { url } };

    return { reply_markup: { inline_keyboard: [[button]] } };
  }

  private pause(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });
  }
}
