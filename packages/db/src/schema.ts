import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", ["telegram", "vk"]);
export const occasionEnum = pgEnum("occasion", ["birthday", "new_year", "other"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "ok", "partial", "failed"]);
export const reservationStatusEnum = pgEnum("reservation_status", ["active", "cancelled"]);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];
export type ItemParseStatus = (typeof parseStatusEnum.enumValues)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  surpriseMode: boolean("surprise_mode").notNull().default(false),
  createdAt: createdAt(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("auth_identities_provider_user_uq").on(t.provider, t.providerUserId),
    uniqueIndex("auth_identities_user_provider_uq").on(t.userId, t.provider),
  ],
);

export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    occasion: occasionEnum("occasion").notNull().default("birthday"),
    eventDate: date("event_date", { mode: "string" }),
    slug: text("slug").notNull().unique(),
    themeId: text("theme_id").notNull().default("journal"),
    createdAt: createdAt(),
  },
  (t) => [index("wishlists_owner_idx").on(t.ownerId)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wishlistId: uuid("wishlist_id").notNull().references(() => wishlists.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url"),
    normalizedUrl: text("normalized_url"),
    store: text("store"),
    title: text("title").notNull().default(""),
    description: text("description"),
    imageKey: text("image_key"),
    priceKopecks: integer("price_kopecks"),
    currency: text("currency").notNull().default("RUB"),
    parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
    note: text("note"),
    isMustHave: boolean("is_must_have").notNull().default(false),
    position: integer("position").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("items_wishlist_idx").on(t.wishlistId)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    guestUserId: uuid("guest_user_id").references(() => users.id, { onDelete: "set null" }),
    guestToken: text("guest_token"),
    guestName: text("guest_name").notNull(),
    cancelToken: text("cancel_token").notNull().unique(),
    status: reservationStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reservations_one_active_per_item_uq").on(t.itemId).where(sql`"status" = 'active'`)],
);

export const parseCache = pgTable("parse_cache", {
  normalizedUrl: text("normalized_url").primaryKey(),
  result: jsonb("result").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// Одно событие — одно сообщение человеку (уникальный индекс), и не больше дневного лимита (индекс по дню)
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    refId: text("ref_id").notNull(),
    sentOn: date("sent_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notification_log_once_uq").on(t.userId, t.kind, t.refId),
    index("notification_log_user_day_idx").on(t.userId, t.sentOn),
  ],
);

// Статистика переходов гостей в магазин: только подарок, магазин и время
export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    store: text("store"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("affiliate_clicks_item_idx").on(t.itemId), index("affiliate_clicks_time_idx").on(t.clickedAt)],
);

// Переходы в поиск магазина из подборщика и блоков идей: подарка ещё нет, поэтому отдельная таблица
export const storeSearchClicks = pgTable(
  "store_search_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    store: text("store").notNull(),
    // Откуда ушёл клик: slug страницы подарков или "finder"
    source: text("source").notNull(),
    query: text("query").notNull(),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_search_clicks_time_idx").on(t.clickedAt), index("store_search_clicks_source_idx").on(t.source)],
);

// Расход на AI-подбор подарков: токены и стоимость каждой попытки.
// Клиент хранится хешем — нужен только для дневного лимита, восстановить IP по нему нельзя.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientHash: text("client_hash").notNull(),
    signedIn: boolean("signed_in").notNull().default(false),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    attempt: integer("attempt").notNull().default(1),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    // Микрорубли: целые числа, чтобы не хранить деньги во float
    costMicroRub: integer("cost_micro_rub").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    outcome: text("outcome").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_time_idx").on(t.createdAt), index("ai_usage_client_idx").on(t.clientHash, t.createdAt)],
);

// Интерес к будущим функциям: один голос пользователя на функцию
export const featureInterest = pgTable(
  "feature_interest",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feature_interest_user_feature_uq").on(t.userId, t.feature)],
);
