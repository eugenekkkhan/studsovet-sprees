import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import { EventsService } from './events.service';

interface EventAnnouncement {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  status?: string;
  announcementMessages?: Array<{ chatId: number; messageId: number }>;
}

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

@Injectable()
export class EventAnnouncementsService {
  private readonly logger = new Logger('EventAnnouncements');

  constructor(
    private readonly telegram: TelegramService,
    private readonly events: EventsService,
  ) {}

  async publish(event: EventAnnouncement) {
    if (!this.telegram.enabled) return;
    const { text, reply_markup } = this.render(event);
    const messages: Array<{ chatId: number; messageId: number }> = [];
    for (const chat of this.telegram.chats.list()) {
      const sent = await this.telegram.api.call<{ message_id: number }>('sendMessage', {
        chat_id: chat.id,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup,
      });
      if (sent) messages.push({ chatId: chat.id, messageId: sent.message_id });
      else this.logger.warn(`Не удалось опубликовать мероприятие в чате ${chat.id}.`);
    }
    this.events.setAnnouncementMessages(event.id, messages);
  }

  async refresh(id: string) {
    const event = this.events.getById(id);
    if (!event) return;
    if (!event.announcementMessages?.length) {
      if (event.status === 'published') await this.publish(event);
      return;
    }
    const { text, reply_markup } = this.render(event);
    for (const message of event.announcementMessages) {
      await this.telegram.api.call('editMessageText', {
        chat_id: message.chatId,
        message_id: message.messageId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup,
      });
    }
  }

  private render(event: EventAnnouncement) {
    const when = new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Moscow',
    }).format(new Date(event.startsAt));
    const text = [
      `<b>${escapeHtml(event.title)}</b>`,
      `🗓 ${escapeHtml(when)}`,
      event.location ? `📍 ${escapeHtml(event.location)}` : '',
      event.description ? `\n${escapeHtml(event.description)}` : '',
      event.status && event.status !== 'published'
        ? `\n<b>${event.status === 'cancelled' ? 'Мероприятие отменено' : 'Запись закрыта'}</b>`
        : '\nВы сможете изменить ответ позже.',
    ].filter(Boolean).join('\n');
    const reply_markup = event.status && event.status !== 'published' ? { inline_keyboard: [] } : {
      inline_keyboard: [[
        { text: '✅ Иду', callback_data: `event:${event.id}:going` },
        { text: '❌ Не иду', callback_data: `event:${event.id}:declined` },
        { text: '🤔 Думаю', callback_data: `event:${event.id}:maybe` },
      ]],
    };

    return { text, reply_markup };
  }
}
