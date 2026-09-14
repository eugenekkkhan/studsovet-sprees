import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [DecksController],
  providers: [DecksService],
})
export class DecksModule {}
