import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { SessionUser } from './types';

/** Ровно та часть запроса, которая нужна охране: заголовки и место под пользователя. */
export interface AuthenticatedRequest {
  headers: Record<string, unknown>;
  user?: SessionUser;
}

/** Достаёт токен из заголовка `Authorization: Bearer …`. */
export const bearerToken = (request: { headers: Record<string, unknown> }) => {
  const header = String(request.headers?.authorization ?? '');
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? (value ?? '').trim() : '';
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = this.auth.verify(bearerToken(request));
    if (!user) {
      throw new UnauthorizedException('Войдите через Telegram — сессия не найдена.');
    }
    request.user = user;
    return true;
  }
}

/** Пользователь запроса, уже проверенный `AuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user as SessionUser,
);
