import { expect, test } from "vitest";
import { imageUrlFor } from "./item-image";

test("joins the public bucket URL and the object key", () => {
  expect(imageUrlFor("items/abc/1.webp", "https://s3.twcstorage.ru/wishlist-images")).toBe("https://s3.twcstorage.ru/wishlist-images/items/abc/1.webp");
  expect(imageUrlFor("items/abc/1.webp", "https://s3.twcstorage.ru/wishlist-images/")).toBe("https://s3.twcstorage.ru/wishlist-images/items/abc/1.webp");
});

test("no key or no configured bucket means no photo", () => {
  expect(imageUrlFor(null, "https://s3.twcstorage.ru/wishlist-images")).toBeNull();
  expect(imageUrlFor("items/abc/1.webp", undefined)).toBeNull();
});
