// US-09 Explorar la oferta · US-12 Ficha del anuncio  (usan los datos de `pnpm db:seed`)
import { test, expect } from "@playwright/test";
import { ROUTES, cards, T } from "./helpers";

test.describe("US-09 Explorar la oferta (visitante, sin sesión)", () => {
  test("TC-024 el listado se ve sin iniciar sesión en inicio, venta y alquiler", async ({
    page,
  }) => {
    for (const path of [ROUTES.home, ROUTES.buy, ROUTES.rent]) {
      await page.goto(path);
      await expect(
        cards(page).first(),
        `${path} debería mostrar anuncios`,
      ).toBeVisible();
    }
  });

  test("TC-025 cada tarjeta muestra foto, precio, ubicación, m² y habitaciones", async ({
    page,
  }) => {
    await page.goto(ROUTES.buy);
    const card = cards(page)
      .filter({ has: page.locator("img") })
      .first();
    await expect(card.locator("img").first()).toBeVisible();
    const text = (await card.innerText()).replace(/\s+/g, " ");
    expect(text, "precio").toMatch(/[€$£]|eur/i);
    expect(text, "m²").toMatch(/m²|m2/i);
    expect(text, "habitaciones").toMatch(/\d/);
  });

  test("TC-026 se puede cambiar entre venta y alquiler", async ({ page }) => {
    await page.goto(ROUTES.buy);
    const venta = await cards(page).first().getAttribute("href");
    await page.goto(ROUTES.rent);
    await expect(cards(page).first()).toBeVisible();
    const alquiler = await cards(page).first().getAttribute("href");
    expect(alquiler).not.toBe(venta); // listados distintos
  });

  test.fixme("TC-027 sin anuncios muestra mensaje informativo", async () => {
    // Requiere una BD vacía (`pnpm db:reset` sin seed). Probar a mano o en un job aparte.
  });
});

test.describe("US-12 Ficha del anuncio", () => {
  test("TC-030 / TC-031 / TC-035 la ficha es visible sin sesión y muestra datos y botón de contacto", async ({
    page,
  }) => {
    await page.goto(ROUTES.buy);
    await cards(page)
      .filter({ has: page.locator("img") })
      .first()
      .click();
    await expect(page).toHaveURL(/\/properties\/[^/]+$/);
    // Esperar a la ficha real: mientras carga, loading.tsx solo pinta esqueletos sin texto.
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main")).toContainText(/[€$£]|eur/i); // precio
    await expect(page.locator("main")).toContainText(/m²|m2/i); // superficie
    await expect(page.locator("main img").first()).toBeVisible(); // galería
    await expect(
      page
        .getByRole("button", { name: T.contact })
        .or(page.getByRole("link", { name: T.contact }))
        .first(),
    ).toBeVisible();
  });

  test("TC-032 un anuncio inexistente devuelve una 404 amigable", async ({
    page,
  }) => {
    await page.goto("/properties/id-que-no-existe-123");
    await expect(
      page.getByRole("heading", { name: /couldn.t find this home/i }),
    ).toBeVisible();
    // Con loading.tsx el estado HTTP es 200 (streaming), pero Next marca la página como noindex.
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.getByText(/stack|at \w+\.\w+ \(/i)).toHaveCount(0); // sin trazas internas
  });

  test("TC-034 la URL de la ficha es compartible (otra sesión ve lo mismo)", async ({
    page,
    browser,
  }) => {
    await page.goto(ROUTES.buy);
    await cards(page).first().click();
    await page.waitForURL(/\/properties\/[^/]+$/);
    const url = page.url();
    const titulo = await page.locator("h1").first().innerText();

    const otro = await browser.newContext();
    const p2 = await otro.newPage();
    await p2.goto(url);
    await expect(p2.locator("h1").first()).toHaveText(titulo);
    await otro.close();
  });

  test.fixme("TC-036 el precio mostrado coincide con el guardado (céntimos)", async () => {
    // Comparar con la BD (Prisma Studio) o con el valor del seed; mejor como test de Vitest sobre el formateador.
  });
});
