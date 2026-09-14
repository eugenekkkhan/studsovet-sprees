import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizModule } from '../quiz/quiz.module';
import { MediaController } from './media.controller';
import { MediaStorage } from './media.storage';

@Module({
  imports: [QuizModule, AuthModule],
  controllers: [MediaController],
  providers: [MediaStorage],
  exports: [MediaStorage],
})
export class MediaModule {}
