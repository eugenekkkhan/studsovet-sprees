import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizGateway } from './quiz.gateway';
import { QuizService } from './quiz.service';

@Module({
  // Комнату открывает вошедший пользователь — шлюзу нужна проверка токена.
  imports: [AuthModule],
  providers: [QuizService, QuizGateway],
  // Загрузка файлов проверяет права ведущего той же службой комнат.
  exports: [QuizService],
})
export class QuizModule {}
