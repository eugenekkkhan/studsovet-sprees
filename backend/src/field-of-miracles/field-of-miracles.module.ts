import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FieldOfMiraclesGateway } from './field-of-miracles.gateway';
import { FieldOfMiraclesService } from './field-of-miracles.service';

@Module({
  // Комнату открывает вошедший пользователь — шлюзу нужна проверка токена.
  imports: [AuthModule],
  providers: [FieldOfMiraclesService, FieldOfMiraclesGateway],
  exports: [FieldOfMiraclesService],
})
export class FieldOfMiraclesModule {}
