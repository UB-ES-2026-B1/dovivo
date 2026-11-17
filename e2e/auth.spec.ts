// US-01 Registro · US-02 Inicio de sesión · US-03 Cerrar sesión
import {
  ROUTES,
  T,
  PASSWORD,
  newUser,
  fillRegister,
  register,
  login,
  logout,
  expectLoggedIn,
  expectLoggedOut,
  test as authed,
  expect,
} from "./helpers";
import { test as base } from "@playwright/test";

const test = base;

test.describe("US-01 Registro", () => {
  test("TC-001 registro correcto inicia sesión y se mantiene al recargar", async ({
    page,
  }) => {
    await register(page, newUser());
    await expectLoggedIn(page);
    await page.reload();
    await expectLoggedIn(page);
  });

  test("TC-002 email ya registrado muestra error y no crea cuenta", async ({
    page,
    context,
  }) => {
    const u = newUser();
    await register(page, u);
    await context.clearCookies();
    await fillRegister(page, { ...u, name: "Otro nombre" });
    await page.getByRole("button", { name: T.submitRegister }).click();
    await expect(page).toHaveURL(new RegExp(ROUTES.register));
    await expect(
      page.getByText(T.duplicateEmail).or(page.getByRole("alert")).first(),
    ).toBeVisible();
    await expectLoggedOut(page);
  });

  test("TC-003 contraseña de 7 caracteres no permite continuar", async ({
    page,
  }) => {
    await fillRegister(page, { ...newUser(), password: "Abcde1!" });
    await page.getByRole("button", { name: T.submitRegister }).click();
    await expect(page).toHaveURL(new RegExp(ROUTES.register));
    await expectLoggedOut(page);
  });

  test("TC-004 contraseña de exactamente 8 caracteres es válida", async ({
    page,
  }) => {
    await register(page, { ...newUser(), password: "Abcdef1!" });
    await expectLoggedIn(page);
  });

  test("TC-006 formulario vacío o email inválido no crea cuenta", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.getByRole("button", { name: T.submitRegister }).click();
    await expect(page).toHaveURL(new RegExp(ROUTES.register));

    await fillRegister(page, { ...newUser(), email: "usuario@" });
    await page.getByRole("button", { name: T.submitRegister }).click();
    await expect(page).toHaveURL(new RegExp(ROUTES.register));
    await expectLoggedOut(page);
  });
});

test.describe("US-02 Inicio de sesión", () => {
  test("TC-008 login correcto", async ({ page, context }) => {
    const u = newUser();
    await register(page, u);
    await context.clearCookies();
    await login(page, u.email, u.password);
    await expectLoggedIn(page);
  });

  test("TC-009 / TC-010 credenciales incorrectas dan el mismo error genérico", async ({
    page,
    context,
  }) => {
    const u = newUser();
    await register(page, u);
    await context.clearCookies();

    const errorText = async (email: string, password: string) => {
      await login(page, email, password);
      await expect(page).toHaveURL(new RegExp(ROUTES.login));
      const msg = page
        .getByRole("alert")
        .or(page.getByText(T.loginError))
        .first();
      await expect(msg).toBeVisible();
      return (await msg.innerText()).trim();
    };

    const wrongPassword = await errorText(u.email, "ContraseñaIncorrecta1!");
    const unknownEmail = await errorText(
      `no.existe.${Date.now()}@example.com`,
      PASSWORD,
    );
    expect(unknownEmail).toBe(wrongPassword); // no revela qué campo falla
    await expectLoggedOut(page);
  });

  test("TC-011 la sesión se mantiene al recargar", async ({
    page,
    context,
  }) => {
    const u = newUser();
    await register(page, u);
    await context.clearCookies();
    await login(page, u.email, u.password);
    await expectLoggedIn(page);
    await page.reload();
    await expectLoggedIn(page);
  });

  test("TC-012 páginas privadas sin sesión redirigen al login", async ({
    page,
  }) => {
    for (const path of [ROUTES.publish, ROUTES.profile]) {
      await page.goto(path);
      await expect(page, `${path} debería redirigir`).toHaveURL(
        new RegExp(ROUTES.login),
      );
    }
  });
});

authed.describe("US-03 Cerrar sesión", () => {
  authed(
    "TC-014 hay opción visible de cerrar sesión con sesión iniciada",
    async ({ page }) => {
      await expectLoggedIn(page);
    },
  );

  authed(
    "TC-015 tras cerrar sesión vuelvo a ser visitante",
    async ({ page }) => {
      await logout(page);
      await expectLoggedOut(page);
      await page.goto(ROUTES.publish);
      await expect(page).toHaveURL(new RegExp(ROUTES.login));
    },
  );

  authed(
    "TC-016 el botón Atrás no muestra páginas privadas tras cerrar sesión",
    async ({ page }) => {
      await page.goto(ROUTES.profile);

      await expect(page).toHaveURL(new RegExp(`${ROUTES.profile}$`));

      await logout(page);

      await expectLoggedOut(page);

      await page.goBack();

      await expect(page).toHaveURL(new RegExp(ROUTES.login));

      await expectLoggedOut(page);
    },
  );
});
