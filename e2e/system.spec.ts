// Pruebas de sistema, salud y responsive
import { test as base } from "@playwright/test";
import {
  ROUTES,
  T,
  test,
  expect,
  cards,
  newSession,
  newListing,
  fillListing,
  submitPublish,
  files,
  login,
  logout,
  register,
  newUser,
  expectLoggedIn,
  expectLoggedOut,
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
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test("TC-081 flujo completo: registro → publicar con foto → otro usuario lo ve y contacta → cerrar sesión", async ({
  page,
  browser,
}) => {
  test.fixme(true, "Pendiente de US-17/US-18/US-21");
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
// Para comprobar TC-081: pnpm test:e2e -- --grep "TC-081"

base("TC-086 flujo en staging", async ({ page, request }) => {
  base.skip(
    !process.env.E2E_BASE_URL,
    "Solo contra staging: define E2E_BASE_URL",
  );
  expect((await request.get(ROUTES.health)).ok()).toBe(true);
  await page.goto(ROUTES.home);
  await expect(cards(page).first()).toBeVisible();

  const u = newUser("staging");
  await register(page, u);
  await logout(page);
  await expectLoggedOut(page);
  await login(page, u.email, u.password);
  await expectLoggedIn(page);
  // TODO: publicar → buscar → contactar cuando US-17/US-21 estén en staging.
});
// Para comprobar TC-086: E2E_BASE_URL=https://dovivo-staging-ahbzg9e9ghb8enb3.francecentral-01.azurewebsites.net pnpm test:e2e -- --grep "TC-086"
