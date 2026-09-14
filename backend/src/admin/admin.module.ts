import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FieldOfMiraclesModule } from '../field-of-miracles/field-of-miracles.module';
import { QuizModule } from '../quiz/quiz.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, QuizModule, FieldOfMiraclesModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
