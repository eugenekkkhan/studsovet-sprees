import { Module } from '@nestjs/common';
import { SpaController } from './spa.controller';

/** Импортируется последним: его маршрут-звёздочка не должна закрывать API. */
@Module({ controllers: [SpaController] })
export class StaticModule {}
