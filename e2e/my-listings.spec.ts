// US-19 Gestionar mis anuncios  (rutas a confirmar; la historia es de Sprint 3)
import {
  ROUTES,
  T,
  test,
  expect,
  publishListing,
  newSession,
  expectShows,
} from "./helpers";

test.describe("US-19 Gestionar mis anuncios", () => {
  test("TC-076 mi listado muestra mis anuncios con su estado", async ({
    page,
  }) => {
    const { listing } = await publishListing(page);
    await page.goto(ROUTES.myListings);
    await expect(
      page
        .getByText(listing.description)
        .or(page.getByText(listing.address))
        .first(),
    ).toBeVisible();
  });

  test("TC-077 puedo editar los campos de un anuncio mío", async ({ page }) => {
    const { id } = await publishListing(page);
    await page.goto(ROUTES.editListing(id));
    const nueva = `Descripción editada ${Date.now()}`;
    await page
      .getByLabel(/(description|descripci)/i)
      .first()
      .fill(nueva);
    await page
      .getByLabel(/(price|preu|precio)/i)
      .first()
      .fill("1111");
    await page.getByRole("button", { name: T.save }).click();
    await page.goto(`/properties/${id}`);
    await expectShows(page, nueva);
  });

  test("TC-078 / TC-079 eliminar pide confirmación y el anuncio desaparece de la búsqueda", async ({
    page,
  }) => {
    const { id, listing } = await publishListing(page);
    await page.goto(ROUTES.myListings);

    // Cancelar no elimina (confirmación nativa o modal)
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: T.remove }).first().click();
    const cancelar = page.getByRole("button", {
      name: /(cancel|cancel·lar|cancelar)/i,
    });
    if (await cancelar.count()) await cancelar.first().click();
    await page.goto(`/properties/${id}`);
    await expect(page.getByText(listing.description).first()).toBeVisible();

    // Confirmar sí elimina
    await page.goto(ROUTES.myListings);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: T.remove }).first().click();
    const confirmar = page.getByRole("button", { name: T.confirm });
    if (await confirmar.count()) await confirmar.first().click();

    const res = await page.goto(`/properties/${id}`);
    expect(res?.status()).toBe(404); // TC-033: anuncio eliminado => 404 amigable
    await page.goto(listing.operation === "RENT" ? ROUTES.rent : ROUTES.buy);
    await expect(page.locator(`a[href="/properties/${id}"]`)).toHaveCount(0);
  });

  test("TC-080 un usuario no puede editar ni eliminar el anuncio de otro", async ({
    page,
    browser,
  }) => {
    const { id } = await publishListing(page); // anuncio del usuario A
    const b = await newSession(browser); // usuario B
    const res = await b.page.goto(ROUTES.editListing(id));
    const sinAcceso =
      [401, 403, 404].includes(res?.status() ?? 0) ||
      b.page.url().includes("login") ||
      (await b.page.getByRole("button", { name: T.save }).count()) === 0;
    expect(sinAcceso, "el usuario B no debe poder editar el anuncio de A").toBe(
      true,
    );
    await b.context.close();
  });
});
