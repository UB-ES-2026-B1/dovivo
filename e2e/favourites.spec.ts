// US-14 Favoritos  (rutas y botones a confirmar; la historia es de Sprint 3)
import { test as base, type Page } from "@playwright/test";
import { ROUTES, T, cards, test, expect, newSession } from "./helpers";

const botonFavorito = (page: Page) =>
  page.getByRole("button", { name: T.favourite }).first();

test.describe("US-14 Favoritos", () => {
  test("TC-070 / TC-072 añadir y quitar favorito desde el listado; aparece en mi lista", async ({
    page,
  }) => {
    await page.goto(ROUTES.buy);
    const href = await cards(page).first().getAttribute("href");
    await botonFavorito(page).click();

    await page.goto(ROUTES.favourites);
    await expect(page.locator(`a[href="${href}"]`)).toBeVisible();

    await botonFavorito(page).click(); // quitar desde la lista
    await page.reload();
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  });

  test("TC-071 añadir favorito desde la ficha", async ({ page }) => {
    await page.goto(ROUTES.buy);
    const href = (await cards(page).first().getAttribute("href"))!;
    await page.goto(href);
    await botonFavorito(page).click();
    await page.goto(ROUTES.favourites);
    await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
  });

  test("TC-075 los favoritos son privados de cada usuario", async ({
    page,
    browser,
  }) => {
    await page.goto(ROUTES.buy);
    const href = (await cards(page).first().getAttribute("href"))!;
    await botonFavorito(page).click();

    const otro = await newSession(browser);
    await otro.page.goto(ROUTES.favourites);
    await expect(otro.page.locator(`a[href="${href}"]`)).toHaveCount(0);
    await otro.context.close();
  });

  test.fixme("TC-073 favorito eliminado o no disponible se muestra indicado", async () => {
    // Requiere 2 usuarios: A publica y B lo marca favorito; A elimina el anuncio; B revisa su lista.
  });
});

base(
  "TC-074 un visitante que pulsa favorito es invitado a iniciar sesión",
  async ({ page }) => {
    await page.goto(ROUTES.buy);
    await botonFavorito(page).click();
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/buy");
  },
);
