import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionUser } from '../auth/types';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('config')
  config(@CurrentUser() user: SessionUser) { return this.admin.config(user); }

  @Get()
  dashboard(@CurrentUser() user: SessionUser) { return this.admin.dashboard(user); }

  @Patch('features/:key')
  setFeature(
    @CurrentUser() user: SessionUser,
    @Param('key') key: string,
    @Body() body: { enabled?: boolean },
  ) { return this.admin.setFeature(user, key, body.enabled === true); }

  @Post('admins/:userId')
  addAdmin(@CurrentUser() user: SessionUser, @Param('userId') id: string) {
    return this.admin.addAdmin(user, Number(id));
  }

  @Delete('admins/:userId')
  removeAdmin(@CurrentUser() user: SessionUser, @Param('userId') id: string) {
    return this.admin.removeAdmin(user, Number(id));
  }

  @Delete('sessions/:game/:code')
  terminateSession(
    @CurrentUser() user: SessionUser,
    @Param('game') game: string,
    @Param('code') code: string,
  ) {
    return this.admin.terminateSession(user, game, code);
  }

  @Post('session-creation-bans/:userId')
  blockSessionCreation(@CurrentUser() user: SessionUser, @Param('userId') id: string) {
    return this.admin.setCreationBlocked(user, Number(id), true);
  }

  @Delete('session-creation-bans/:userId')
  allowSessionCreation(@CurrentUser() user: SessionUser, @Param('userId') id: string) {
    return this.admin.setCreationBlocked(user, Number(id), false);
  }
}
