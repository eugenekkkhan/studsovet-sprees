import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class SessionCreationPolicyService {
  constructor(private readonly database: DatabaseService) {}

  async isBlocked(userId: number) {
    if (!this.database.enabled) return false;
    const result = await this.database.query(
      'SELECT 1 FROM session_creation_bans WHERE user_id = $1',
      [userId],
    );
    return Boolean(result.rowCount);
  }
}
