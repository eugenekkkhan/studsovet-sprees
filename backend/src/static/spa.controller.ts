import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../env';

/** Пути сервера: их не подменяем страницей, иначе ошибки API станут неотличимы. */
const API_PREFIXES = ['auth', 'decks', 'participants', 'media', 'socket.io'];

/**
 * Собранный фронт и API живут на одном адресе — так мини-приложению Telegram
 * достаётся одна ссылка и не нужен CORS. Файлы отдаёт статика Express, а сюда
 * попадают маршруты вроде `/quiz` — их знает только роутер в браузере.
 */
@Controller()
export class SpaController {
  private cache: { html: string; mtimeMs: number } | null = null;

  /** Корень: Express-статика его не отдаёт, чтобы заголовки были одни и те же. */
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  root() {
    return this.html();
  }

  @Get('*path')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  index(@Param('path') path: string | string[]) {
    // Express отдаёт хвост адреса массивом сегментов, но пусть строка тоже работает.
    const [first] = Array.isArray(path) ? path : String(path ?? '').split('/');
    if (API_PREFIXES.includes(first)) {
      throw new NotFoundException('Такого метода нет.');
    }
    return this.html();
  }

  /** Читаем заново после пересборки фронта: сервер ради этого перезапускать незачем. */
  private html() {
    const file = join(env.staticDir, 'index.html');
    if (!existsSync(file)) {
      throw new NotFoundException(
        'Фронт не собран. Соберите его командой npm run build.',
      );
    }
    return readFileSync(file, 'utf8');
  }
}
