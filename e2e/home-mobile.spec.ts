import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile home keeps the gift scene visible between the CTA and the next section", async ({ page }) => {
  await page.goto("/");

  const actions = page.locator(".hero__actions");
  const scene = page.locator(".hero__scene");
  const image = scene.getByRole("img");
  const nextSection = page.locator("#how");

  await expect(scene).toBeVisible();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  const actionsBox = await actions.boundingBox();
  const sceneBox = await scene.boundingBox();
  const nextSectionBox = await nextSection.boundingBox();

  expect(actionsBox).not.toBeNull();
  expect(sceneBox).not.toBeNull();
  expect(nextSectionBox).not.toBeNull();
  expect(sceneBox!.height).toBeGreaterThanOrEqual(320);
  expect(sceneBox!.height).toBeLessThanOrEqual(400);
  expect(sceneBox!.y).toBeGreaterThanOrEqual(actionsBox!.y + actionsBox!.height);
  expect(nextSectionBox!.y).toBeGreaterThanOrEqual(sceneBox!.y + sceneBox!.height);
});
