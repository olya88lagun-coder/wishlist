import { themeInterestAction } from "./actions";

export function ThemeInterest({ wishlistId, voted }: { wishlistId: string; voted: boolean }) {
  return (
    <section className="panel stack owner-theme-card" aria-label="Оформление списка">
      <div className="row row--between">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Оформление</h2>
        <span className="muted">«Журнал»</span>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Готовим другие варианты: строгий «Минимал» и нежную «Романтику».
      </p>
      {voted ? (
        <p className="muted" style={{ margin: 0 }}>
          Спасибо! Учли, что вам это интересно.
        </p>
      ) : (
        <form action={themeInterestAction.bind(null, wishlistId)}>
          <button type="submit" className="button button--ghost button--small">
            Хочу другое оформление
          </button>
        </form>
      )}
    </section>
  );
}
