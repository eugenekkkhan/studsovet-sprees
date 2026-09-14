import { JsonStore } from '../storage/json-store';
import { env } from '../env';

export interface AllowedChat {
  id: number;
  title: string;
  type: string;
  addedAt: number;
}

interface RegistryFile {
  chats: AllowedChat[];
}

/**
 * Чаты, в которые добавили бота. Пропуск в приложение выдаётся по участию
 * хотя бы в одном из них, поэтому список переживает перезапуск.
 */
export class ChatRegistry {
  private readonly store = new JsonStore<RegistryFile>('chats.json', () => ({
    chats: [],
  }));

  /** Чаты из настроек добавляются к сохранённым: их нельзя потерять. */
  list(): AllowedChat[] {
    const saved = this.store.read().chats;
    // Явный список превращает реестр в закрытую экосистему: старые тестовые
    // группы остаются в файле для истории, но больше не дают доступ и не
    // принимают события состава.
    if (env.allowedChatIds.length > 0) {
      return env.allowedChatIds.map((id) =>
        saved.find((chat) => chat.id === id) ?? {
          id,
          title: `Чат ${id}`,
          type: 'unknown',
          addedAt: 0,
        },
      );
    }
    return saved;
  }

  has(id: number) {
    return this.list().some((chat) => chat.id === id);
  }

  remember(chat: { id: number; title?: string; type?: string }): AllowedChat {
    const entry: AllowedChat = {
      id: chat.id,
      title: (chat.title ?? '').trim().slice(0, 200) || `Чат ${chat.id}`,
      type: chat.type ?? 'group',
      addedAt: Date.now(),
    };
    this.store.update((current) => ({
      chats: [...current.chats.filter((item) => item.id !== chat.id), entry],
    }));
    return entry;
  }

  forget(id: number) {
    this.store.update((current) => ({
      chats: current.chats.filter((chat) => chat.id !== id),
    }));
  }
}
