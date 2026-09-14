import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import type { SessionUser } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Открытый эндпоинт: фронт спрашивает его до всякого входа. */
  @Get('config')
  config() {
    return this.auth.config();
  }

  @Post('telegram')
  login(@Body() body: { initData?: string }) {
    const initData = String(body?.initData ?? '');
    if (!initData) throw new BadRequestException('Не пришли данные Telegram.');
    return this.auth.loginWithInitData(initData);
  }

  @Post('telegram/widget')
  loginFromWebsite(@Body() body: { user?: unknown }) {
    return this.auth.loginWithWidget(body?.user);
  }

  @Post('dev')
  loginAsDeveloper(@Body() body: { name?: string }) {
    return this.auth.loginAsDeveloper(body?.name ?? '');
  }

  @Post('test')
  loginAsTester(@Body() body: { key?: string; name?: string }) {
    return this.auth.loginAsTester(body?.key ?? '', body?.name ?? '');
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: SessionUser) {
    await this.auth.refreshKnownParticipant(user);
    return { user };
  }
}
