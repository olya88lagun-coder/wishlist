// Общие для web (ставит задачи) и worker (выполняет)
export const QUEUES = {
  parseItem: "parse-item",
  maintenance: "maintenance",
  notify: "notify",
  reminders: "reminders",
  canary: "canary",
  uptime: "uptime",
} as const;

// Сообщение бота с карточкой подарка: после парсинга воркер его отредактирует
export type BotMessageRef = { chatId: number; messageId: number };

export type ParseItemJob = { itemId: string; botMessage?: BotMessageRef };

// В задачу кладём только id: тексты воркер собирает из базы, чтобы в очереди не лежали имена
export type NotifyJob = { kind: "reservation_created"; itemId: string } | { kind: "item_deleted"; itemId: string };

// Одна повторная попытка: если воркер упал посреди задачи, pg-boss вернёт её через 2 минуты
export const PARSE_JOB_OPTIONS = { retryLimit: 1, retryDelay: 30, expireInSeconds: 120 } as const;

// Telegram временно отвечает 429/5xx — три повтора с паузой в минуту
export const NOTIFY_JOB_OPTIONS = { retryLimit: 3, retryDelay: 60, expireInSeconds: 60 } as const;
