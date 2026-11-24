/**
 * Utilidades compartidas de los tests E2E de Dovivo.
 *
 * IMPORTANTE: los textos (T) y las rutas (ROUTES) son SUPOSICIONES hechas sin ver la interfaz.
 * Si un test falla porque no encuentra un botón o campo, corrige aquí UNA vez
 * y se arregla en todos los tests. Para sacar los selectores reales:
 *   pnpm exec playwright codegen http://localhost:3000/register
 */
import {
  expect,
  test as base,
  type Browser,
  type Page,
} from "@playwright/test";

/** Expresiones regulares (es / ca / en) para localizar textos de la interfaz. */
export const T = {
  name: /\b(name|nom|nombre)\b/i,
  email: /e-?mail|correo/i,
  password: /(password|contrasenya|contraseña)/i,
  phone: /phone|tel[eè]fon|teléfono|móvil/i,
  submitRegister:
    /(sign up|register|create account|registr|crear (cuenta|compte))/i,
  submitLogin: /(sign in|log in|login|iniciar|entrar|accedir)/i,
  logout: /(sign out|log out|logout|cerrar sesi|tancar sessi)/i,
  save: /(save|guardar|desar|actualizar|update)/i,
  publish: /(publish|publicar)/i,
  edit: /(edit|editar)/i,
  remove: /(delete|remove|eliminar|esborrar|borrar)/i,
  confirm: /(confirm|sí|si,|yes|accept|aceptar|acceptar)/i,
  contact: /(contact|escribir|enviar mensaje|message|missatge)/i,
  send: /(send|enviar)/i,
  favourite: /(favou?rite|favorit|preferit)/i,
  cover: /(cover|portada)/i,
  // Mensajes
  loginError:
    /(invalid|incorrect|wrong|error|inv[aà]lid|incorrect|credencial)/i,
  duplicateEmail:
    /(already|exist|registered|en uso|ya (est|exist)|ja (est|exist))/i,
  sent: /(sent|enviad|enviat|thanks|gracias|gr[aà]cies|success|[eè]xit)/i,
  tooBig: /(5 ?mb|too large|too big|demasiado|massa gran|tamaño|mida|size)/i,
  invalidFormat:
    /(jpe?g|png|format|formato|invalid|inv[aà]lid|not allowed|no permit)/i,
  maxFiles: /(15|max|máximo|màxim|too many|demasiad|massa)/i,
  empty:
    /(no (results|listings|properties|anuncios|resultados)|sin resultados|cap resultat|no hi ha)/i,
};

/** Rutas. `profile`, `myListings`, `favourites` y `editListing` son suposiciones: confirmar con el equipo. */
export const ROUTES = {
  home: "/",
  buy: "/buy",
  rent: "/rent",
  register: "/register",
  login: "/login",
  publish: "/publish",
  profile: "/profile",
  myListings: "/my-properties",
  favourites: "/favourites",
  editListing: (id: string) => `/properties/${id}/edit`,
  health: "/api/health",
};

export const PASSWORD = "Password123!";

export type User = { name: string; email: string; password: string };

let counter = 0;
export function newUser(prefix = "qa"): User {
  counter += 1;
  const id = `${Date.now()}${counter}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `QA ${prefix} ${id}`,
    email: `${prefix}.${id}@example.com`,
    password: PASSWORD,
  };
}

/** Anuncios de la semilla (`pnpm db:seed`): enlaces a /properties/<id>. */
export const cards = (page: Page) => page.locator('a[href^="/properties/"]');

/** Campo por etiqueta o, si no hay <label>, por placeholder. */
export const field = (page: Page, label: RegExp) =>
  page.getByLabel(label).or(page.getByPlaceholder(label)).first();

/** Botón por nombre o, si no coincide, el botón de envío del formulario. */
export const submitButton = (page: Page, name: RegExp) =>
  page
    .getByRole("button", { name })
    .or(page.locator('form button[type="submit"]'))
    .first();

export async function fillRegister(page: Page, u: User) {
  await page.goto(ROUTES.register);
  await field(page, T.name).fill(u.name);
  await field(page, T.email).fill(u.email);
  await field(page, T.password).fill(u.password);
}

/** Registra un usuario. El registro debe dejar la sesión iniciada por sí solo (US-01). */
export async function register(page: Page, u: User) {
  await fillRegister(page, u);
  await submitButton(page, T.submitRegister).click();
  await expectLoggedIn(page);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto(ROUTES.login);
  await field(page, T.email).fill(email);
  await field(page, T.password).fill(password);
  await submitButton(page, T.submitLogin).click();
}

/** Espera a que un texto aparezca en la página, ya sea como texto o como valor de un <input>. */
export async function expectShows(page: Page, value: string) {
  await page.waitForFunction(
    (v) =>
      document.body.innerText.includes(v) ||
      Array.from(document.querySelectorAll("input,textarea")).some(
        (i) => (i as HTMLInputElement).value === v,
      ),
    value,
    { timeout: 10_000 },
  );
}

export const logoutControl = (page: Page) =>
  page
    .getByRole("button", { name: T.logout })
    .or(page.getByRole("link", { name: T.logout }))
    .first();

export async function expectLoggedIn(page: Page) {
  await expect(logoutControl(page)).toBeVisible({ timeout: 20_000 });
}

export async function expectLoggedOut(page: Page) {
  await expect(logoutControl(page)).toHaveCount(0);
}

export async function logout(page: Page) {
  await logoutControl(page).click();
  await page.waitForLoadState("networkidle");
}

/** Elige una opción en un <select> o, si es otro control, en radio/botón. */
export async function choose(page: Page, group: RegExp, option: RegExp) {
  const control = page.getByLabel(group).first();
  if (
    (await control.count()) > 0 &&
    (await control.evaluate((e) => e.tagName)) === "SELECT"
  ) {
    const texts = await control.locator("option").allTextContents();
    const match = texts.find((t) => option.test(t));
    if (!match) throw new Error(`No hay opción ${option} en ${group}`);
    await control.selectOption({ label: match });
    return;
  }
  const radio = page.getByRole("radio", { name: option }).first();
  if ((await radio.count()) > 0) return void (await radio.check());
  await page.getByRole("button", { name: option }).first().click();
}

export type Listing = {
  operation: "SALE" | "RENT";
  type: RegExp;
  price: string;
  area: string;
  rooms: string;
  bathrooms: string;
  address: string;
  description: string;
};

export function newListing(over: Partial<Listing> = {}): Listing {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    operation: "RENT",
    type: /(apartment|piso|apartament|flat)/i,
    price: "950",
    area: "70",
    rooms: "2",
    bathrooms: "1",
    address: `Carrer QA ${id}, Barcelona`,
    description: `Anuncio de prueba QA ${id}`,
    ...over,
  };
}

const FIELD = {
  price: /(price|preu|precio)/i,
  area: /(m²|m2|area|superf|sqm|surface)/i,
  rooms: /(rooms|bedrooms|habitaci|hab\.)/i,
  bathrooms: /(bath|baños|banys)/i,
  address: /(address|direcci|adre[cç]a|location|ubicaci)/i,
  description: /(description|descripci)/i,
} as const;

/** Rellena el formulario de /publish. `skip` deja un campo sin rellenar (para probar obligatorios). */
export async function fillListing(
  page: Page,
  l: Listing,
  skip?: keyof typeof FIELD | "operation" | "type",
) {
  if (skip !== "operation")
    await choose(
      page,
      /(operation|operaci|listing type|tipo de operaci)/i,
      l.operation === "SALE"
        ? /(sale|venta|venda|buy|comprar)/i
        : /(rent|alquiler|lloguer)/i,
    );
  if (skip !== "type")
    await choose(
      page,
      /(property type|tipo de (inmueble|propiedad)|tipus|type)/i,
      l.type,
    );
  for (const key of Object.keys(FIELD) as (keyof typeof FIELD)[]) {
    if (key === skip) continue;
    await field(page, FIELD[key]).fill(l[key]);
  }
}

export const submitPublish = (page: Page) =>
  page.getByRole("button", { name: T.publish }).last().click();

/** Publica un anuncio y devuelve el id leído de la URL de la ficha (/properties/<id>). */
export async function publishListing(page: Page, over: Partial<Listing> = {}) {
  const listing = newListing(over);
  await page.goto(ROUTES.publish);
  await fillListing(page, listing);
  await submitPublish(page);
  await page.waitForURL(/\/properties\/[^/]+/, { timeout: 20_000 });
  const id = new URL(page.url()).pathname.split("/")[2]!;
  return { listing, id };
}

/** Ficheros de prueba en memoria (no hace falta tener imágenes en disco). */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
export const files = {
  png: (name = "foto.png") => ({
    name,
    mimeType: "image/png",
    buffer: PNG_1PX,
  }),
  jpg: (name = "foto.jpg") => ({
    name,
    mimeType: "image/jpeg",
    buffer: Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(2000),
    ]),
  }),
  bigJpg: (bytes = 5 * 1024 * 1024 + 1) => ({
    name: "grande.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(bytes - 4),
    ]),
  }),
  gif: () => ({
    name: "animada.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  }),
  pdf: () => ({
    name: "doc.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  }),
  fakeJpg: () => ({
    name: "malicioso.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("MZ\u0090\u0000\u0003"),
  }),
};

/** Crea un segundo usuario con su propia sesión (otro contexto de navegador). */
export async function newSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = newUser("otro");
  await register(page, user);
  return { context, page, user };
}

/**
 * `test` con un usuario ya registrado y con sesión iniciada en `page`.
 * La fixture es `auto: true`: se ejecuta en TODOS los tests que usen este `test`,
 * aunque no pidan `user` (Playwright solo crea las fixtures que el test nombra).
 * Los tests de visitante (sin sesión) deben usar `test` de "@playwright/test".
 */
export const test = base.extend<{ user: User }>({
  user: [
    async ({ page }, provide) => {
      const u = newUser();
      await register(page, u);
      await provide(u);
    },
    { auto: true },
  ],
});
export { expect };
