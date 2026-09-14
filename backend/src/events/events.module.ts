import { forwardRef, Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EventsController } from './events.controller';
import { EventAnnouncementsService } from './event-announcements.service';
import { EventRemindersService } from './event-reminders.service';
import { EventsService } from './events.service';
import { RatingService } from './rating.service';

@Module({
  imports: [ActivityModule, forwardRef(() => AuthModule), forwardRef(() => TelegramModule)],
  controllers: [EventsController],
  providers: [EventsService, RatingService, EventAnnouncementsService, EventRemindersService],
  exports: [EventsService],
})
export class EventsModule {}
