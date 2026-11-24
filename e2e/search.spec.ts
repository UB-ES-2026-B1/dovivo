// US-10 Búsqueda con filtros
// Los nombres de los campos de filtro son suposiciones: ajustar FILTER si hace falta.
import { test, expect, type Page } from "@playwright/test";
import { ROUTES, cards, T } from "./helpers";

const FILTER = {
  minPrice: /(min.*(price|preu|precio)|(price|preu|precio).*min|desde|from)/i,
  maxPrice: /(max.*(price|preu|precio)|(price|preu|precio).*max|hasta|to\b)/i,
  rooms: /(rooms|bedrooms|habitaci)/i,
  area: /(m²|m2|area|superf)/i,
  location: /(location|ubicaci|ciudad|city|barrio|barri|ciutat)/i,
};

const amount = (s: string) =>
  Number(
    (/\d[\d.,]*/.exec(s)?.[0] ?? "0")
      .replace(/[.,](?=\d{3}\b)/g, "")
      .replace(",", "."),
  );

async function setFilter(page: Page, label: RegExp, value: string) {
  const field = page.getByLabel(label).first();
  await field.fill(value);
  await field.press("Enter");
  await page.waitForLoadState("networkidle");
}

test.describe("US-10 Búsqueda con filtros", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.buy);
    await expect(cards(page).first()).toBeVisible();
  });

  test("TC-037 filtrar por operación muestra anuncios distintos en compra y alquiler", async ({
    page,
  }) => {
    const compra = await cards(page).first().getAttribute("href");
    await page.goto(ROUTES.rent);
    expect(await cards(page).first().getAttribute("href")).not.toBe(compra);
  });

  test("TC-038 filtro de precio mínimo y máximo", async ({ page }) => {
    await setFilter(page, FILTER.minPrice, "100000");
    await setFilter(page, FILTER.maxPrice, "300000");
    const n = await cards(page).count();
    expect(n).toBeGreaterThan(0);
    for (const price of await cards(page).evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText),
    )) {
      const v = amount(price);
      expect(v).toBeGreaterThanOrEqual(100000);
      expect(v).toBeLessThanOrEqual(300000);
    }
  });

  for (const [tc, name, label, value] of [
    ["TC-039", "habitaciones", FILTER.rooms, "3"],
    ["TC-040", "m²", FILTER.area, "80"],
    ["TC-042", "ubicación", FILTER.location, "Barcelona"],
  ] as const) {
    test(`${tc} filtro de ${name} actualiza la URL y no rompe la página`, async ({
      page,
    }) => {
      await setFilter(page, label, value);
      expect(page.url()).toContain("?");
      await expect(
        page.getByText(/application error|something went wrong/i),
      ).toHaveCount(0);
    });
  }

  test.fixme("TC-041 filtro de tipo de inmueble", async () => {
    // Completar tras ver el control real (select / chips) con `playwright codegen`.
  });

  test("TC-043 combinar filtros y ver el número de resultados", async ({
    page,
  }) => {
    await setFilter(page, FILTER.minPrice, "50000");
    await setFilter(page, FILTER.rooms, "2");
    await expect(
      page
        .getByText(/\d+\s*(results|resultats|resultados|anuncios|properties)/i)
        .first(),
    ).toBeVisible();
  });

  test("TC-044 los resultados se actualizan sin recargar la página completa", async ({
    page,
  }) => {
    await page.evaluate(
      () => ((window as unknown as { __qa: number }).__qa = 1),
    ); // marca que se pierde si hay recarga
    await setFilter(page, FILTER.minPrice, "100000");
    expect(
      await page.evaluate(() => (window as unknown as { __qa?: number }).__qa),
    ).toBe(1);
  });

  test("TC-045 sin resultados sugiere relajar los filtros", async ({
    page,
  }) => {
    await setFilter(page, FILTER.minPrice, "999999999");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText(T.empty).first()).toBeVisible();
  });

  test("TC-046 los filtros quedan en la URL y la búsqueda es compartible", async ({
    page,
    browser,
  }) => {
    await setFilter(page, FILTER.minPrice, "100000");
    const url = page.url();
    expect(url).toContain("?");
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto(url);
    await expect(p2.getByLabel(FILTER.minPrice).first()).toHaveValue(
      /100.?000/,
    );
    await ctx.close();
  });

  test("TC-047 valores incoherentes no rompen la aplicación", async ({
    page,
  }) => {
    await setFilter(page, FILTER.minPrice, "500000");
    await setFilter(page, FILTER.maxPrice, "100");
    await setFilter(page, FILTER.minPrice, "-5");
    await expect(
      page.getByText(/application error|unhandled|internal server error/i),
    ).toHaveCount(0);
  });

  test("TC-048 caracteres especiales en la ubicación no ejecutan código ni rompen la página", async ({
    page,
  }) => {
    let dialog = false;
    page.on("dialog", async (d) => {
      dialog = true;
      await d.dismiss();
    });
    for (const v of [`' OR 1=1 --`, `"><script>alert(1)</script>`, "😀"]) {
      await setFilter(page, FILTER.location, v);
      await expect(
        page.getByText(/application error|internal server error/i),
      ).toHaveCount(0);
    }
    expect(dialog).toBe(false);
  });
});
