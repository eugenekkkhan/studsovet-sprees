import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { createLimiter } from '../common/rate-limit';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionUser } from '../auth/types';
import { DecksService, type DeckAuthor, type DeckVisibility } from './decks.service';

const authorOf = (user: SessionUser): DeckAuthor => ({ id: user.id, name: user.name });

/**
 * Код доступа не угадать перебором, но и молотить по нему не дадим: два
 * десятка попыток в минуту хватает человеку и мало роботу.
 */
const accessLimiter = createLimiter({ points: 20, windowMs: 60_000 });

/** Код из тела запроса: длину проверяем до похода в базу. */
const codeOf = (value: unknown, userId: number) => {
  const code = String(value ?? '').trim();
  if (code.length < 16 || code.length > 64) {
    throw new BadRequestException('Неверный код доступа.');
  }
  if (!accessLimiter.hit(String(userId))) {
    throw new HttpException('Слишком много попыток. Подождите минуту.', HttpStatus.TOO_MANY_REQUESTS);
  }
  return code;
};

const visibilityOf = (value: unknown): DeckVisibility => {
  if (value === 'private' || value === 'published') return value;
  throw new BadRequestException('Видимость бывает только приватной или общей.');
};

/**
 * Колоды автора и общая библиотека. Свои колоды правит только их владелец;
 * в библиотеке лежат опубликованные, а администратор видит там и приватные.
 */
@Controller('decks')
@UseGuards(AuthGuard)
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser) {
    return { decks: await this.decks.list(user.id) };
  }

  /** Объявлен до `:id`, иначе маршрут по идентификатору перехватит адрес. */
  @Get('library')
  library(@CurrentUser() user: SessionUser) {
    return this.decks.library(authorOf(user));
  }

  @Get(':id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.decks.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() body: { deck?: unknown }) {
    return this.decks.save(authorOf(user), '', body?.deck);
  }

  /** Взять чужую опубликованную колоду себе — копией, не ссылкой. */
  @Post('copy')
  copy(
    @CurrentUser() user: SessionUser,
    @Body() body: { authorId?: unknown; deckId?: unknown },
  ) {
    const authorId = Number(body?.authorId);
    const deckId = String(body?.deckId ?? '');
    if (!Number.isFinite(authorId) || !deckId) {
      throw new BadRequestException('Не указано, какую колоду копировать.');
    }
    return this.decks.copyToOwn(authorOf(user), authorId, deckId);
  }

  /** Открыть колоду по секретному коду: только чтение, правки автору. */
  @Post('access')
  access(@CurrentUser() user: SessionUser, @Body() body: { code?: unknown }) {
    return this.decks.accessShare(codeOf(body?.code, user.id));
  }

  /** Забрать независимую копию — если автор это разрешил. */
  @Post('access/copy')
  copyShared(@CurrentUser() user: SessionUser, @Body() body: { code?: unknown }) {
    return this.decks.copyShare(authorOf(user), codeOf(body?.code, user.id));
  }

  /** Выдаёт код доступа. Тот же вызов меняет код: старые ссылки умирают. */
  @Post(':id/share')
  issueShare(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { allowCopy?: unknown },
  ) {
    return this.decks.issueShare(user.id, id, body?.allowCopy !== false);
  }

  /** Разрешение на копию меняется отдельно — код при этом остаётся прежним. */
  @Patch(':id/share')
  setShareOptions(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { allowCopy?: unknown },
  ) {
    return this.decks.setShareOptions(user.id, id, body?.allowCopy !== false);
  }

  @Delete(':id/share')
  revokeShare(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.decks.revokeShare(user.id, id);
  }

  @Put(':id')
  save(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { deck?: unknown },
  ) {
    return this.decks.save(authorOf(user), id, body?.deck);
  }

  @Patch(':id/visibility')
  setVisibility(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: { visibility?: unknown },
  ) {
    return this.decks.setVisibility(user.id, id, visibilityOf(body?.visibility));
  }

  @Delete(':id')
  remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.decks.remove(user.id, id);
  }
}
