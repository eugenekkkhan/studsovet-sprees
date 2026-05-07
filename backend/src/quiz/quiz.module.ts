import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizGateway } from './quiz.gateway';
import { QuizService } from './quiz.service';

@Module({
  controllers: [QuizController],
  providers: [QuizGateway, QuizService],
})
export class QuizModule {}
