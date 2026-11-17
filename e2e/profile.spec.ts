// US-04 Consultar perfil · US-05 Editar perfil
import { ROUTES, T, test, expect, expectShows } from "./helpers";
import { test as anon } from "@playwright/test";

anon("TC-019 perfil sin sesión redirige al login", async ({ page }) => {
  await page.goto(ROUTES.profile);
  await expect(page).toHaveURL(new RegExp(ROUTES.login));
});

test.describe("US-04 / US-05 Perfil", () => {
  test("TC-017 veo mi nombre y mi email", async ({ page, user }) => {
    await page.goto(ROUTES.profile);
    await expectShows(page, user.email);
    await expectShows(page, user.name);
  });

  test.fixme("TC-018 no puedo ver el perfil de otro usuario", async () => {
    // Depende del diseño: si /profile es siempre «el mío» el caso se cumple por construcción.
    // Si existe /profile/[id], abrir el de otro usuario y esperar 403/404 o redirección.
  });

  test("TC-020 / TC-023 modificar el nombre se ve al instante y tras recargar", async ({ page }) => {
    const nuevo = `Nombre QA ${Date.now()}`;
    await page.goto(ROUTES.profile);
    await page.getByLabel(T.name).first().fill(nuevo);
    await page.getByRole("button", { name: T.save }).click();
    await expectShows(page, nuevo);
    await page.reload();
    await expect(page.getByLabel(T.name).first()).toHaveValue(nuevo);
  });

  test("TC-021 añadir y cambiar teléfono", async ({ page }) => {
    await page.goto(ROUTES.profile);
    for (const tel of ["+34600111222", "+34699888777"]) {
      await page.getByLabel(T.phone).first().fill(tel);
      await page.getByRole("button", { name: T.save }).click();
      await page.reload();
      await expect(page.getByLabel(T.phone).first()).toHaveValue(tel);
    }
  });

  test("TC-022 un campo inválido muestra error y no guarda nada", async ({ page }) => {
    await page.goto(ROUTES.profile);
    const nombreOriginal = await page.getByLabel(T.name).first().inputValue();
    await page.getByLabel(T.name).first().fill("");
    await page.getByLabel(T.phone).first().fill("abc");
    await page.getByRole("button", { name: T.save }).click();
    await expect(page.getByRole("alert").or(page.locator(":invalid")).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(T.name).first()).toHaveValue(nombreOriginal);
  });
});
