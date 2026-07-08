# Studsovet Sprees

Фуллстек-приложение для проведения интеллектуальных игр в реальном времени: «Поле чудес» и квиз. Ведущий управляет игрой, участники подключаются со своих устройств, состояние синхронизируется через WebSocket.

## Структура

- `src/` — фронтенд: React + TypeScript + Vite
- `backend/` — NestJS + Socket.IO (WebSocket-гейтвеи игр)

## Запуск

Фронтенд:

```bash
npm install
npm run dev
```

Бэкенд:

```bash
cd backend
npm install
npm run start:dev
```

## Стек

React, TypeScript, Vite, React Router, Socket.IO, NestJS
