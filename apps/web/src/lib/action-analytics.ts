import { trackEvent } from "./analytics";
import type { AnalyticsEvent, AnalyticsParams } from "./analytics-events";

// Обёртка вызывается один раз после ответа action, независимо от повторных рендеров формы.
export function withActionAnalytics<State extends { status: string }>(
  action: (previous: State, form: FormData) => Promise<State>,
  event: AnalyticsEvent,
  params?: AnalyticsParams,
) {
  return async (previous: State, form: FormData): Promise<State> => {
    const result = await action(previous, form);
    if (result.status === "success") trackEvent(event, params);
    return result;
  };
}
