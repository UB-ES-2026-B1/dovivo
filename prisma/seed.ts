/**
 * Development seed data (US-09, T-15): demo advertisers and listings, so the public listing has
 * something to show and its speed can be measured with many listings (`prisma/bench-list.ts`).
 *
 *   pnpm db:seed                  # 1,000 listings
 *   pnpm db:seed --count 10000    # benchmark size (contract §8)
 *
 * Re-running it replaces the previous seed data: every user with a SEED_EMAIL_DOMAIN email is
 * deleted first, and their listings and photos go with them (cascade). Other data is untouched.
 * The data is generated from a fixed random seed, so every run (and every teammate) gets the same
 * listings. Seed users have no password, so nobody can sign in as them.
 */
import { parseArgs } from "node:util";

import {
  type ListingStatus,
  type ListingType,
  type Prisma,
  PrismaClient,
  type PropertyType,
  type UserRole,
} from "@prisma/client";

const SEED_EMAIL_DOMAIN = "seed.dovivo.test";

const DEFAULT_COUNT = 1_000;
const MAX_COUNT = 100_000;
const OWNER_COUNT = 25;
const BATCH_SIZE = 1_000;

const { values: args } = parseArgs({
  options: { count: { type: "string", default: String(DEFAULT_COUNT) } },
});
const count = Number(args.count);
if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
  throw new Error(`--count must be an integer between 1 and ${MAX_COUNT}.`);
}

/** Small deterministic PRNG (mulberry32), so the data is the same on every machine. */
function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)]!;
  /** Picks a key of `weights` with probability proportional to its value. */
  const weighted = <K extends string>(weights: Record<K, number>): K => {
    const entries = Object.entries(weights) as [K, number][];
    let roll = next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return entries[entries.length - 1]![0];
  };
  return { next, int, pick, weighted };
}

const CITIES = [
  {
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08",
    neighborhoods: ["Gràcia", "Eixample", "Sants", "Poblenou", "Sarrià"],
  },
  {
    city: "L'Hospitalet de Llobregat",
    province: "Barcelona",
    postalCode: "08",
    neighborhoods: ["Bellvitge", "Collblanc", "Santa Eulàlia"],
  },
  {
    city: "Sabadell",
    province: "Barcelona",
    postalCode: "08",
    neighborhoods: ["Centre", "Can Rull", "La Creu Alta"],
  },
  {
    city: "Terrassa",
    province: "Barcelona",
    postalCode: "08",
    neighborhoods: ["Centre", "Ca n'Aurell", "Sant Pere"],
  },
  {
    city: "Mataró",
    province: "Barcelona",
    postalCode: "08",
    neighborhoods: ["Centre", "Cerdanyola", "Rocafonda"],
  },
  {
    city: "Girona",
    province: "Girona",
    postalCode: "17",
    neighborhoods: ["Barri Vell", "Montilivi", "Santa Eugènia"],
  },
  {
    city: "Lleida",
    province: "Lleida",
    postalCode: "25",
    neighborhoods: ["Centre Històric", "Cappont", "Pardinyes"],
  },
  {
    city: "Tarragona",
    province: "Tarragona",
    postalCode: "43",
    neighborhoods: ["Part Alta", "El Serrallo", "Sant Pere i Sant Pau"],
  },
  {
    city: "Reus",
    province: "Tarragona",
    postalCode: "43",
    neighborhoods: ["Centre", "Sant Pere", "Mas Iglesias"],
  },
] as const;

const STREETS = [
  "Carrer Major",
  "Carrer de la Pau",
  "Avinguda Diagonal",
  "Rambla Nova",
  "Carrer de Sant Joan",
  "Passeig de la Riba",
  "Carrer del Sol",
];

const TYPE_LABELS: Record<PropertyType, string> = {
  APARTMENT: "Pis",
  HOUSE: "Casa",
  STUDIO: "Estudi",
  ROOM: "Habitació",
  OFFICE: "Oficina",
  LAND: "Terreny",
  OTHER: "Immoble",
};

const random = createRandom(20261029);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const now = Date.now();

function buildOwners(): Prisma.UserCreateManyInput[] {
  return Array.from({ length: OWNER_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    const role: UserRole = i < 5 ? "AGENT" : "USER";
    return {
      id: `seed_user_${n}`,
      name: role === "AGENT" ? `Agència de prova ${n}` : `Anunciant ${n}`,
      email: `owner${n}@${SEED_EMAIL_DOMAIN}`,
      role,
    };
  });
}

function buildProperty(
  index: number,
  ownerIds: string[],
): Prisma.PropertyCreateManyInput {
  const id = `seed_prop_${String(index + 1).padStart(6, "0")}`;
  const listingType: ListingType = random.weighted({ SALE: 55, RENT: 45 });
  const propertyType: PropertyType = random.weighted({
    APARTMENT: 55,
    HOUSE: 15,
    STUDIO: 10,
    ROOM: listingType === "RENT" ? 10 : 0,
    OFFICE: 4,
    LAND: listingType === "SALE" ? 4 : 0,
    OTHER: 2,
  });
  const status: ListingStatus = random.weighted({
    PUBLISHED: 85,
    DRAFT: 7,
    RESERVED: 4,
    CLOSED: 4,
  });
  const place = random.pick(CITIES);
  const neighborhood =
    random.next() < 0.8 ? random.pick(place.neighborhoods) : null;

  const bedrooms = {
    APARTMENT: random.int(1, 4),
    HOUSE: random.int(2, 6),
    STUDIO: 0,
    ROOM: 1,
    OFFICE: null,
    LAND: null,
    OTHER: random.next() < 0.5 ? random.int(1, 3) : null,
  }[propertyType];
  const areaM2 = {
    APARTMENT: random.int(45, 140),
    HOUSE: random.int(90, 400),
    STUDIO: random.int(25, 45),
    ROOM: random.int(9, 20),
    OFFICE: random.int(40, 300),
    LAND: random.int(300, 5000),
    OTHER: random.int(20, 200),
  }[propertyType];

  // Land is far cheaper per m². Sale prices rounded to 1,000 €, rents to 10 €/month. Stored in
  // cents, so they must stay under 2^31 cents (~21.4 M €, `priceCents` is an Int).
  const eurosPerM2 =
    listingType === "SALE"
      ? propertyType === "LAND"
        ? random.int(30, 300)
        : random.int(1_500, 5_000)
      : random.int(10, 25);
  const priceCents =
    listingType === "SALE"
      ? Math.round((areaM2 * eurosPerM2) / 1_000) * 100_000
      : Math.round((areaM2 * eurosPerM2) / 10) * 1_000;

  const createdAt = new Date(now - random.int(1, 365) * DAY_MS);
  // Rounded to the hour so many listings share a publishedAt, as the cursor tie-breaker expects.
  const publishedAt =
    status === "DRAFT"
      ? null
      : new Date(
          Math.floor(
            (createdAt.getTime() + random.int(0, 72) * HOUR_MS) / HOUR_MS,
          ) * HOUR_MS,
        );

  const label = TYPE_LABELS[propertyType];
  const where = neighborhood ? `${neighborhood}, ${place.city}` : place.city;
  const rooms = bedrooms ? ` de ${bedrooms} habitacions` : "";

  return {
    id,
    title: `${label}${rooms} a ${where}`,
    description: `${label} de ${areaM2} m² a ${where}. Anunci de prova generat pel seed de desenvolupament.`,
    listingType,
    propertyType,
    status,
    priceCents,
    bedrooms,
    bathrooms: bedrooms ? random.int(1, Math.max(1, bedrooms - 1)) : null,
    areaM2,
    address: `${random.pick(STREETS)}, ${random.int(1, 180)}`,
    neighborhood,
    city: place.city,
    province: place.province,
    postalCode: `${place.postalCode}${String(random.int(0, 999)).padStart(3, "0")}`,
    hasElevator: random.next() < 0.5,
    hasParking: random.next() < 0.3,
    isFurnished: listingType === "RENT" && random.next() < 0.6,
    ownerId: random.pick(ownerIds),
    createdAt,
    publishedAt,
    // A few soft-deleted listings, which must never show up in the public listing.
    deletedAt:
      random.next() < 0.03 ? new Date(now - random.int(0, 30) * DAY_MS) : null,
  };
}

/** 0-5 photos. Most listings mark the first one as cover; some don't, to exercise the fallback. */
function buildImages(
  propertyId: string,
): Prisma.PropertyImageCreateManyInput[] {
  const photoCount = random.next() < 0.1 ? 0 : random.int(1, 5);
  const markCover = random.next() < 0.8;
  return Array.from({ length: photoCount }, (_, position) => {
    const key = `dovivo-${propertyId}-${position}`;
    return {
      propertyId,
      // Placeholder photos from picsum.photos: same seed key, same image.
      url: `https://picsum.photos/seed/${key}/1200/800`,
      thumbnailUrl: `https://picsum.photos/seed/${key}/480/320`,
      alt: `Foto ${position + 1}`,
      mimeType: "image/jpeg",
      sizeBytes: random.int(150_000, 2_500_000),
      width: 1200,
      height: 800,
      position,
      isCover: markCover && position === 0,
    };
  });
}

async function inBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await insert(rows.slice(i, i + BATCH_SIZE));
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed with NODE_ENV=production.");
  }
  const db = new PrismaClient();
  try {
    const started = performance.now();
    const { count: removed } = await db.user.deleteMany({
      where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
    });

    const owners = buildOwners();
    const ownerIds = owners.map((owner) => owner.id!);
    const properties = Array.from({ length: count }, (_, i) =>
      buildProperty(i, ownerIds),
    );
    const images = properties.flatMap((property) => buildImages(property.id!));

    await db.user.createMany({ data: owners });
    await inBatches(properties, (data) => db.property.createMany({ data }));
    await inBatches(images, (data) => db.propertyImage.createMany({ data }));

    const visible = properties.filter(
      (p) => p.status === "PUBLISHED" && !p.deletedAt,
    ).length;
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(
      `Seed: removed ${removed} previous seed users; created ${owners.length} users, ` +
        `${properties.length} listings (${visible} visible in the public listing) and ` +
        `${images.length} photos in ${seconds}s.`,
    );
  } finally {
    await db.$disconnect();
  }
}

await main();
