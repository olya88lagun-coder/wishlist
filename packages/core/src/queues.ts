// Общие для web (ставит задачи) и worker (выполняет)
export const QUEUES = { parseItem: "parse-item", maintenance: "maintenance" } as const;

export type ParseItemJob = { itemId: string };

// Одна повторная попытка: если воркер упал посреди задачи, pg-boss вернёт её через 2 минуты
export const PARSE_JOB_OPTIONS = { retryLimit: 1, retryDelay: 30, expireInSeconds: 120 } as const;
