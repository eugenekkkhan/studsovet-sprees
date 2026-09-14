import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionUser } from '../auth/types';
import { ParticipantsService } from './participants.service';

@Controller('participants')
@UseGuards(AuthGuard)
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.participants.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.participants.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.participants.update(user, id, body ?? {});
  }
}
