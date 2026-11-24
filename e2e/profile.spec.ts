// US-04 Consultar perfil · US-05 Editar perfil
import { ROUTES, T, test, expect } from "./helpers";
import { test as anon, type Page } from "@playwright/test";

anon("TC-019 perfil sin sesión redirige al login", async ({ page }) => {
  await page.goto(ROUTES.profile);
  await expect(page).toHaveURL(new RegExp(ROUTES.login));
});

const editar = (page: Page) =>
  page.getByRole("button", { name: T.edit }).click();
// El nombre también sale en la cabecera, por eso se busca dentro de <main>.
const main = (page: Page) => page.locator("main");

test.describe("US-04 / US-05 Perfil", () => {
  test("TC-017 veo mi nombre y mi email", async ({ page, user }) => {
    await page.goto(ROUTES.profile);
    await expect(main(page)).toContainText(user.email);
    await expect(main(page)).toContainText(user.name);
  });

  test.fixme("TC-018 no puedo ver el perfil de otro usuario", async () => {
    // /profile es siempre «el mío» (user.me usa la sesión): se cumple por construcción.
  });

  test("TC-020 / TC-023 modificar el nombre se ve al instante y tras recargar", async ({
    page,
  }) => {
    const nuevo = `Nombre QA ${Date.now()}`;
    await page.goto(ROUTES.profile);
    await editar(page);
    await page.getByLabel(T.name).first().fill(nuevo);
    await page.getByRole("button", { name: T.save }).click();
    await expect(main(page)).toContainText(nuevo); // sin recargar
    await page.reload();
    await expect(main(page)).toContainText(nuevo);
  });

  test("TC-021 añadir y cambiar teléfono", async ({ page }) => {
    for (const tel of ["+34600111222", "+34699888777"]) {
      await page.goto(ROUTES.profile);
      await editar(page);
      await page.getByLabel(T.phone).first().fill(tel);
      await page.getByRole("button", { name: T.save }).click();
      await expect(page.getByText("Changes saved.")).toBeVisible();
      await page.reload();
      await expect(main(page)).toContainText(tel);
    }
  });

  test("TC-022 un campo inválido muestra error y no guarda nada", async ({
    page,
    user,
  }) => {
    await page.goto(ROUTES.profile);
    await editar(page);
    await page.getByLabel(T.name).first().fill("");
    await page.getByLabel(T.phone).first().fill("abc");
    await page.getByRole("button", { name: T.save }).click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    await page.reload();
    await expect(main(page)).toContainText(user.name);
    await expect(main(page)).not.toContainText("abc");
  });
});
