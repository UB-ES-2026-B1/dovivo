/**
 * Measures the public listing query (US-09) against the local database, with the filter
 * combinations visitors use most. Seed it first with many listings:
 *
 *   pnpm db:seed --count 10000
 *   pnpm db:bench               # add --runs 100 for steadier numbers
 *
 * It runs `listPropertyCards`, the same function `property.list` calls, but without the tRPC
 * layer (which adds an artificial delay in development). Fails when a scenario's p95 is over the
 * target from the backend contract (§8: p95 under 300 ms at the API), well below the 3 s US-09
 * allows for the whole page.
 */
import { parseArgs } from "node:util";

import { PrismaClient } from "@prisma/client";

import {
  type PropertyFilters,
  propertyFiltersSchema,
} from "~/lib/validators/property";
import { prismaGlobalOmit } from "~/server/db-omit";
import { listPropertyCards } from "~/server/services/property-list";

const P95_TARGET_MS = 300;
const WARMUP_RUNS = 5;

const { values: args } = parseArgs({
  options: { runs: { type: "string", default: "50" } },
});
const runs = Number(args.runs);
if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("--runs must be a positive integer.");
}

const db = new PrismaClient({ omit: prismaGlobalOmit });

/** Cursor of the page after `pages` pages of `filters`, to measure deep pagination. */
async function cursorAfter(filters: Partial<PropertyFilters>, pages: number) {
  let cursor: string | undefined;
  for (let page = 0; page < pages; page++) {
    const result = await listPropertyCards(
      db,
      propertyFiltersSchema.parse({ ...filters, cursor }),
    );
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return cursor;
}

function percentile(sortedMs: number[], p: number) {
  const index = Math.min(
    sortedMs.length - 1,
    Math.ceil((p / 100) * sortedMs.length) - 1,
  );
  return sortedMs[Math.max(0, index)]!;
}

async function measure(filters: Partial<PropertyFilters>) {
  const input = propertyFiltersSchema.parse(filters);
  let items = 0;
  for (let i = 0; i < WARMUP_RUNS; i++) await listPropertyCards(db, input);

  const timesMs: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const page = await listPropertyCards(db, input);
    timesMs.push(performance.now() - start);
    items = page.items.length;
  }
  timesMs.sort((a, b) => a - b);
  return {
    items,
    p50: percentile(timesMs, 50),
    p95: percentile(timesMs, 95),
    max: timesMs[timesMs.length - 1]!,
  };
}

async function main() {
  const visible = await db.property.count({
    where: { status: "PUBLISHED", deletedAt: null },
  });
  console.log(`Visible listings in the database: ${visible}`);
  if (visible < 1_000) {
    console.warn(
      "Fewer than 1,000 visible listings: run `pnpm db:seed --count 10000` first.",
    );
  }

  const scenarios: [string, Partial<PropertyFilters>][] = [
    ["All listings", {}],
    ["Sale", { listingType: "SALE" }],
    ["Rent", { listingType: "RENT" }],
    ["Rent, max 50 per page", { listingType: "RENT", limit: 50 }],
    ["Rent in Barcelona", { listingType: "RENT", city: "barcelona" }],
    [
      "Sale, 3+ bedrooms, up to 400,000 €",
      { listingType: "SALE", minBedrooms: 3, maxPriceCents: 40_000_000 },
    ],
    [
      "Sale, page 21",
      {
        listingType: "SALE",
        cursor: await cursorAfter({ listingType: "SALE" }, 20),
      },
    ],
  ];

  const rows = [];
  for (const [name, filters] of scenarios) {
    const result = await measure(filters);
    rows.push({
      scenario: name,
      items: result.items,
      "p50 (ms)": Number(result.p50.toFixed(1)),
      "p95 (ms)": Number(result.p95.toFixed(1)),
      "max (ms)": Number(result.max.toFixed(1)),
      ok: result.p95 < P95_TARGET_MS ? "yes" : "NO",
    });
  }
  console.table(rows);

  const slow = rows.filter((row) => row.ok !== "yes");
  if (slow.length > 0) {
    console.error(
      `p95 over ${P95_TARGET_MS} ms in: ${slow.map((row) => row.scenario).join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`All scenarios under the ${P95_TARGET_MS} ms p95 target.`);
  }
}

try {
  await main();
} finally {
  await db.$disconnect();
}
