import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { SessionCreationPolicyService } from './session-creation-policy.service';

@Global()
@Module({
  providers: [DatabaseService, SessionCreationPolicyService],
  exports: [DatabaseService, SessionCreationPolicyService],
})
export class DatabaseModule {}
