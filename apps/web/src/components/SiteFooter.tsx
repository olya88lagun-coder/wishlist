// Статические страницы (политика) собираются без переменных окружения — берём известное имя бота
const DEFAULT_BOT_USERNAME = "my_wish_list1_bot";

export function SiteFooter({ botUsername = process.env.TELEGRAM_BOT_USERNAME ?? DEFAULT_BOT_USERNAME }: { botUsername?: string }) {
  return (
    <footer className="site-footer">
      <span>my-wish-list.online</span>
      <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
        Бот в Telegram
      </a>
      <a href={`https://t.me/${botUsername}?start=feedback`} target="_blank" rel="noopener noreferrer">
        Написать отзыв
      </a>
      <a href="/privacy">Политика конфиденциальности</a>
    </footer>
  );
}
