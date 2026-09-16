export function SiteFooter({ botUsername }: { botUsername: string }) {
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
