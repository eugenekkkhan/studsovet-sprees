import { forwardRef, Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { EventsModule } from '../events/events.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ActivityModule, forwardRef(() => EventsModule)],
  providers: [TelegramService, TelegramBotService],
  exports: [TelegramService],
})
export class TelegramModule {}
