import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionUser } from '../auth/types';
import { EventAnnouncementsService } from './event-announcements.service';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(AuthGuard)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly announcements: EventAnnouncementsService,
  ) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.events.list(user);
  }

  @Get('reliability')
  reliability() {
    return this.events.listReliability();
  }

  @Post()
  async create(@CurrentUser() user: SessionUser, @Body() body: Record<string, unknown>) {
    const event = await this.events.create(user, body ?? {});
    await this.announcements.publish(event);
    return event;
  }

  @Put(':id')
  async update(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const event = await this.events.update(user, id, body ?? {});
    await this.announcements.refresh(id);
    return event;
  }

  @Patch(':id/coordinators')
  setCoordinators(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { coordinatorIds?: unknown },
  ) {
    return this.events.setCoordinators(user, id, body?.coordinatorIds);
  }

  @Post(':id/rsvp')
  rsvp(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { status?: string; reason?: string },
  ) {
    return this.events.rsvp(user, id, body?.status ?? '', body?.reason ?? '');
  }

  @Post(':id/attendance/code')
  generateAttendanceCode(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.events.generateAttendanceCode(user, id);
  }

  @Post(':id/attendance/confirm')
  confirmAttendance(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { code?: string },
  ) {
    return this.events.confirmAttendance(user, id, body?.code ?? '');
  }

  @Post(':id/attendance/manual')
  setAttendance(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { userId?: number; name?: string; present?: boolean },
  ) {
    return this.events.setAttendance(
      user, id, Number(body?.userId), body?.name ?? '', body?.present === true,
    );
  }

  @Post(':id/finalize')
  async finalize(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    const result = await this.events.finalize(user, id);
    await this.announcements.refresh(id);
    return result;
  }
}
