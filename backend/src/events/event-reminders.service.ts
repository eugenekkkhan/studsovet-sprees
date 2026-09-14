import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import { EventsService, type EventReminder } from './events.service';

const CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class EventRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EventReminders');
  private timer?: NodeJS.Timeout;
  private checking = false;

  constructor(
    private readonly events: EventsService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    if (!this.telegram.enabled) return;
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
    this.timer.unref();
    void this.check();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async check() {
    if (this.checking) return;
    this.checking = true;
    try {
      for (const reminder of this.events.dueReminders()) {
        // Фиксируем попытку до отправки: пользователь, закрывший личку с ботом,
        // не должен получать новый запрос каждую минуту.
        this.events.markReminderAttempts(reminder.eventId, reminder.relatedKeys);
        await this.send(reminder);
      }
    } finally {
      this.checking = false;
    }
  }

  private async send(reminder: EventReminder) {
    const when = new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Moscow',
    }).format(new Date(reminder.startsAt));
    const question = reminder.status === 'maybe'
      ? 'Вы отмечали «Пока думаю». Уже получилось определиться?'
      : 'Напоминаем: вы записаны на это мероприятие.';
    const sent = await this.telegram.api.call('sendMessage', {
      chat_id: reminder.userId,
      text: `<b>${this.escape(reminder.title)}</b>\n🗓 ${this.escape(when)}\n\n${question}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Иду', callback_data: `event:${reminder.eventId}:going` },
          { text: '❌ Не иду', callback_data: `event:${reminder.eventId}:declined` },
          { text: '🤔 Думаю', callback_data: `event:${reminder.eventId}:maybe` },
        ]],
      },
    });
    if (!sent) {
      this.logger.debug(`Напоминание пользователю ${reminder.userId} не доставлено.`);
    }
  }

  private escape(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}
