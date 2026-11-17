// US-17 Publicar anuncio · US-18 Subir fotos
import { test as base, type Page } from "@playwright/test";
import {
  ROUTES,
  T,
  test,
  expect,
  newListing,
  fillListing,
  submitPublish,
  publishListing,
  files,
} from "./helpers";

base("TC-052 publicar sin sesión redirige al login", async ({ page }) => {
  await page.goto(ROUTES.publish);
  await expect(page).toHaveURL(new RegExp(ROUTES.login));
});

test.describe("US-17 Publicar anuncio", () => {
  test("TC-049 un anuncio válido se publica y aparece en el listado", async ({
    page,
  }) => {
    const { listing, id } = await publishListing(page);
    await expect(page.getByText(listing.description).first()).toBeVisible();
    // Aparece en el listado de su operación (puede ir en otra página si el listado está paginado)
    await page.goto(listing.operation === "RENT" ? ROUTES.rent : ROUTES.buy);
    await expect(page.locator(`a[href="/properties/${id}"]`)).toBeVisible();
  });

  const obligatorios = [
    "price",
    "area",
    "rooms",
    "bathrooms",
    "address",
    "description",
  ] as const;
  for (const campo of obligatorios) {
    test(`TC-050 falta el campo obligatorio «${campo}»: no se publica y se indica el error`, async ({
      page,
    }) => {
      await page.goto(ROUTES.publish);
      await fillListing(page, newListing(), campo);
      await submitPublish(page);
      await expect(page).toHaveURL(new RegExp(ROUTES.publish));
      await expect(
        page.getByRole("alert").or(page.locator(":invalid")).first(),
      ).toBeVisible();
    });
  }

  for (const [nombre, cambio] of [
    ["precio 0", { price: "0" }],
    ["precio negativo", { price: "-100" }],
    ["m² negativos", { area: "-20" }],
    ["habitaciones decimales", { rooms: "2.5" }],
  ] as const) {
    test(`TC-051 valor inválido (${nombre}) se rechaza`, async ({ page }) => {
      await page.goto(ROUTES.publish);
      await fillListing(page, newListing(cambio));
      await submitPublish(page);
      await expect(page).toHaveURL(new RegExp(ROUTES.publish));
    });
  }

  test("TC-053 se puede publicar venta y alquiler", async ({ page }) => {
    for (const operation of ["SALE", "RENT"] as const) {
      const { listing } = await publishListing(page, {
        operation,
        price: operation === "SALE" ? "250000" : "900",
      });
      await expect(page.getByText(listing.description).first()).toBeVisible();
    }
  });

  test("TC-055 HTML o script en la descripción se muestra como texto y no se ejecuta", async ({
    page,
  }) => {
    const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>`;
    let dialog = false;
    page.on("dialog", async (d) => {
      dialog = true;
      await d.dismiss();
    });
    await publishListing(page, { description: payload });
    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined();
    expect(dialog).toBe(false);
  });

  test.fixme("TC-054 doble clic en Publicar crea un único anuncio", async () => {
    // Contar anuncios del usuario en «Mis anuncios» (US-19) tras un doble clic.
  });
});

test.describe("US-18 Subir fotos", () => {
  const fileInput = (page: Page) => page.locator('input[type="file"]').first();

  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.publish);
  });

  test("TC-056 se pueden subir una foto JPG y una PNG válidas", async ({
    page,
  }) => {
    await fileInput(page).setInputFiles([files.jpg(), files.png()]);
    await expect(page.locator("main img")).toHaveCount(2);
  });

  test("TC-057 máximo 15 fotos: la 16.ª se rechaza", async ({ page }) => {
    const quince = Array.from({ length: 15 }, (_, i) =>
      files.png(`foto${i}.png`),
    );
    await fileInput(page).setInputFiles(quince);
    await expect(page.locator("main img")).toHaveCount(15);
    await fileInput(page).setInputFiles([files.png("foto16.png")]);
    await expect(page.getByText(T.maxFiles).first()).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(15);
  });

  test("TC-058 foto de más de 5 MB se rechaza con mensaje claro", async ({
    page,
  }) => {
    await fileInput(page).setInputFiles(files.bigJpg());
    await expect(page.getByText(T.tooBig).first()).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(0);
  });

  test("TC-059 foto de exactamente 5 MB se acepta", async ({ page }) => {
    await fileInput(page).setInputFiles(files.bigJpg(5 * 1024 * 1024));
    await expect(page.getByText(T.tooBig)).toHaveCount(0);
  });

  for (const [nombre, f] of [
    ["GIF", files.gif()],
    ["PDF", files.pdf()],
    [".exe renombrado a .jpg", files.fakeJpg()],
  ] as const) {
    test(`TC-060 formato no válido (${nombre}) se rechaza`, async ({
      page,
    }) => {
      await fileInput(page).setInputFiles(f);
      await expect(page.getByText(T.invalidFormat).first()).toBeVisible();
      await expect(page.locator("main img")).toHaveCount(0);
    });
  }

  test("TC-061 elegir foto de portada", async ({ page }) => {
    await fileInput(page).setInputFiles([
      files.png("a.png"),
      files.png("b.png"),
    ]);
    await page.getByRole("button", { name: T.cover }).nth(1).click();
    await expect(page.getByText(T.cover).first()).toBeVisible();
  });

  test("TC-062 eliminar una foto", async ({ page }) => {
    await fileInput(page).setInputFiles([
      files.png("a.png"),
      files.png("b.png"),
    ]);
    await page.getByRole("button", { name: T.remove }).first().click();
    await expect(page.locator("main img")).toHaveCount(1);
  });

  test.fixme("TC-063 las fotos se sirven optimizadas", async () => {
    // Comprobar en DevTools → Network el peso/formato (Next Image) o con Lighthouse.
  });
});
