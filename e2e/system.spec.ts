// Pruebas de sistema, salud y responsive
import { test as base } from "@playwright/test";
import {
  ROUTES, T, test, expect, newSession, newListing, fillListing, submitPublish, files, logout, expectLoggedOut,
} from "./helpers";

base("TC-082 /api/health responde OK", async ({ request }) => {
  const res = await request.get(ROUTES.health);
  expect(res.ok()).toBe(true);
});

base.describe("TC-083 responsive en móvil (390×844)", () => {
  base.use({ viewport: { width: 390, height: 844 } });

  for (const path of [ROUTES.home, ROUTES.buy, ROUTES.login, ROUTES.register]) {
    base(`sin scroll horizontal en ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test("TC-081 flujo completo: registro → publicar con foto → otro usuario lo ve y contacta → cerrar sesión", async ({ page, browser }) => {
  // Usuario A (ya registrado y con sesión gracias a la fixture) publica con foto
  const listing = newListing();
  await page.goto(ROUTES.publish);
  await fillListing(page, listing);
  await page.locator('input[type="file"]').first().setInputFiles(files.png());
  await submitPublish(page);
  await page.waitForURL(/\/properties\/[^/]+/);
  const id = new URL(page.url()).pathname.split("/")[2]!;
  await expect(page.getByText(listing.description).first()).toBeVisible();

  // Usuario B lo encuentra en el listado, abre la ficha y contacta
  const b = await newSession(browser);
  await b.page.goto(listing.operation === "RENT" ? ROUTES.rent : ROUTES.buy);
  await expect(b.page.locator(`a[href="/properties/${id}"]`)).toBeVisible();
  await b.page.goto(`/properties/${id}`);
  await b.page.getByRole("textbox").last().fill("Mensaje de prueba E2E");
  await b.page.getByRole("button", { name: T.send }).click();
  await expect(b.page.getByText(T.sent).first()).toBeVisible();
  await logout(b.page);
  await expectLoggedOut(b.page);
  await b.context.close();

  // Usuario A cierra sesión
  await logout(page);
  await expectLoggedOut(page);
});

base.fixme("TC-086 flujo completo en staging", async () => {
  // Ejecutar toda la suite contra staging:  E2E_BASE_URL=https://staging.example pnpm test:e2e
});
