import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, statSync } from 'node:fs';
import { AuthService } from '../auth/auth.service';
import { bearerToken } from '../auth/auth.guard';
import { QuizService } from '../quiz/quiz.service';
import {
  MAX_UPLOAD_BYTES,
  MediaStorage,
  type IncomingFile,
} from './media.storage';

interface UploadHeaders extends Record<string, unknown> {
  authorization?: string;
  'x-quiz-room'?: string;
  'x-quiz-host-token'?: string;
  'x-quiz-host-key'?: string;
}

/** Файлы для колод: загружает ведущий, отдаём всем — их видит зал. */
@Controller('media')
export class MediaController {
  constructor(
    private readonly storage: MediaStorage,
    private readonly quiz: QuizService,
    private readonly auth: AuthService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  upload(
    @UploadedFile() file: IncomingFile | undefined,
    @Headers() headers: UploadHeaders,
  ) {
    // Файлы кладёт либо вошедший автор колоды, либо ведущий комнаты —
    // своим токеном или ключом второго пульта.
    const room = String(headers['x-quiz-room'] ?? '').trim().toUpperCase();
    const token = String(headers['x-quiz-host-token'] ?? '');
    const key = String(headers['x-quiz-host-key'] ?? '');
    const allowed =
      this.auth.verify(bearerToken({ headers })) ||
      (token && this.quiz.getHostState(room, token)) ||
      (key && this.quiz.getHostStateByJoinKey(room, key));
    if (!allowed) {
      throw new ForbiddenException('Войдите через Telegram или откройте комнату.');
    }

    if (!file) throw new BadRequestException('Файл не пришёл.');
    if (!this.storage.isAllowed(file.mimetype)) {
      throw new BadRequestException(
        `Такой формат не принимаем. Можно: ${this.storage.allowedTypes.join(', ')}.`,
      );
    }

    const stored = this.storage.save(file);
    if (!stored) {
      throw new BadRequestException('Файл пустой или слишком большой.');
    }
    return stored;
  }

  /**
   * Файлы отдаются с того же адреса, что и приложение, а рядом в localStorage
   * лежит токен сессии. В `<img>` скрипты внутри SVG не работают, но при
   * прямом переходе по ссылке браузер открывает файл как документ — и вот там
   * бы заработали. `sandbox` без `allow-scripts` это закрывает и заодно
   * уводит документ в отдельный origin, откуда до токена не дотянуться.
   */
  @Get('files/:name')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  serve(
    @Param('name') name: string,
    @Headers('range') range: string | undefined,
    @Res() response: any,
  ) {
    const found = this.storage.locate(name);
    if (!found) throw new NotFoundException('Файл не найден.');
    const size = statSync(found.path).size;
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', found.contentType);
    if (!range) {
      response.setHeader('Content-Length', size);
      createReadStream(found.path).pipe(response);
      return;
    }
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) {
      response.status(416).setHeader('Content-Range', `bytes */${size}`);
      response.end();
      return;
    }
    const start = Number(match[1]);
    const end = Math.min(match[2] ? Number(match[2]) : size - 1, size - 1);
    if (start >= size || end < start) {
      response.status(416).setHeader('Content-Range', `bytes */${size}`);
      response.end();
      return;
    }
    response.status(206);
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    response.setHeader('Content-Length', end - start + 1);
    createReadStream(found.path, { start, end }).pipe(response);
  }
}
