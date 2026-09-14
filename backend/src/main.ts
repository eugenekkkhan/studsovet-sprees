// Первым делом — настройки: `env` читает файл `.env`, а остальные модули
// разбирают переменные окружения уже на загрузке. Порядок импортов важен.
import { env } from './env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { isSpaNavigation } from './static/spa-navigation';

type NavigationRequest = { method: string; headers: { accept?: string } };
type NavigationResponse = {
  setHeader(name: string, value: string): void;
  sendFile(path: string): void;
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: env.frontendOrigins.length > 0 ? env.frontendOrigins : true,
    credentials: true,
  });
  // Колода целиком приезжает одним JSON — стандартных 100 КБ на неё не хватает.
  app.useBodyParser('json', { limit: '8mb' });

  // Файлы фронта идут вперёд контроллеров, страницы — после них (SpaController).
  if (existsSync(env.staticDir)) {
    app.useStaticAssets(env.staticDir, { index: false });
    app.use((
      request: NavigationRequest,
      response: NavigationResponse,
      next: () => void,
    ) => {
      if (!isSpaNavigation(request.method, request.headers.accept)) {
        next();
        return;
      }

      response.setHeader('Cache-Control', 'no-cache');
      response.sendFile(join(env.staticDir, 'index.html'));
    });
  }

  if (env.telegramEnabled && !env.sessionSecretProvided) {
    new Logger('Bootstrap').warn(
      'SESSION_SECRET не задан: после перезапуска всем придётся войти заново.',
    );
  }

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}

void bootstrap();
