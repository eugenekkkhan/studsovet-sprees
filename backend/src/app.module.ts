import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DecksModule } from './decks/decks.module';
import { DatabaseModule } from './database/database.module';
import { ParticipantsModule } from './participants/participants.module';
import { FieldOfMiraclesModule } from './field-of-miracles/field-of-miracles.module';
import { EventsModule } from './events/events.module';
import { MediaModule } from './media/media.module';
import { QuizModule } from './quiz/quiz.module';
import { StaticModule } from './static/static.module';
import { TelegramModule } from './telegram/telegram.module';
import { AuthorizationModule } from './authorization/authorization.module';

@Module({
  imports: [
    ActivityModule,
    AdminModule,
    TelegramModule,
    AuthModule,
    DatabaseModule,
    AuthorizationModule,
    ParticipantsModule,
    DecksModule,
    EventsModule,
    FieldOfMiraclesModule,
    QuizModule,
    MediaModule,
    // Последним: страница отдаётся только там, где не ответил ни один контроллер.
    StaticModule,
  ],
})
export class AppModule {}
