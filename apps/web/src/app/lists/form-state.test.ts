import { expect, test } from "vitest";
import { errorState, formValues, initialFormState, successState } from "./form-state";

test("form state helpers", () => {
  expect(initialFormState).toEqual({ status: "idle", errors: {}, message: null, values: {} });
  expect(errorState({ title: "Введите название" })).toEqual({ status: "error", errors: { title: "Введите название" }, message: null, values: {} });
  expect(errorState({}, "Слишком часто")).toEqual({ status: "error", errors: {}, message: "Слишком часто", values: {} });
  expect(successState("Сохранено")).toEqual({ status: "success", errors: {}, message: "Сохранено", values: {} });
});

test("error state keeps submitted values so React form reset does not wipe user input", () => {
  const form = new FormData();
  form.set("url", "https://www.wildberries.ru/catalog/1/detail.aspx");
  form.set("price", "1 472");
  form.set("isMustHave", "on");
  form.set("$ACTION_ID_abc", "");
  form.set("photo", new Blob(["x"]));

  expect(errorState({ title: "Введите название" }, null, formValues(form)).values).toEqual({
    url: "https://www.wildberries.ru/catalog/1/detail.aspx",
    price: "1 472",
    isMustHave: "on",
  });
});
