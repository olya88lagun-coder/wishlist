import { OTHER_PROJECTS, otherProjectUrl } from "@/content/other-projects";

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
      <span>
        Другие проекты автора:{" "}
        {OTHER_PROJECTS.map((project, index) => (
          <span key={project.id}>
            {index > 0 ? ", " : ""}
            <a href={otherProjectUrl(project, "footer")} target="_blank" rel="noopener noreferrer">
              {project.name}
            </a>
          </span>
        ))}
      </span>
    </footer>
  );
}
