-- Search keys for the location filters (US-10). Written by hand: `citySearch` is required and the
-- table already has rows, so it is added as nullable, backfilled, then made NOT NULL.

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "citySearch" TEXT,
ADD COLUMN "neighborhoodSearch" TEXT;

-- Backfill with the same rules as `normalizeSearchText` (src/lib/search-text.ts):
-- lower case, accents removed, typographic apostrophes as ', no middle dot or full stops, single
-- spaces. Plain SQL instead of the `unaccent` extension, which managed Postgres may not allow.
-- New rows get these values from the API.
UPDATE "Property"
SET
    "citySearch" = btrim(regexp_replace(regexp_replace(translate(lower("city"),
        'àáâäãåāăąèéêëēėęěìíîïīįòóôöõōőùúûüūůűçćčñńňýÿśšźżžďťřľĺŀ’‘`´',
        'aaaaaaaaaeeeeeeeeiiiiiiooooooouuuuuuucccnnnyysszzzdtrlll'''''''''),
        '[·.]', '', 'g'), '\s+', ' ', 'g')),
    "neighborhoodSearch" = NULLIF(btrim(regexp_replace(regexp_replace(translate(lower("neighborhood"),
        'àáâäãåāăąèéêëēėęěìíîïīįòóôöõōőùúûüūůűçćčñńňýÿśšźżžďťřľĺŀ’‘`´',
        'aaaaaaaaaeeeeeeeeiiiiiiooooooouuuuuuucccnnnyysszzzdtrlll'''''''''),
        '[·.]', '', 'g'), '\s+', ' ', 'g')), '');

-- The DEFAULT keeps the migration backwards compatible: CI applies it before the new app is
-- running (and it stays if the deploy fails), and the previous app creates listings without
-- `citySearch`. Such a listing just isn't found by city until it is saved again.
ALTER TABLE "Property" ALTER COLUMN "citySearch" SET DEFAULT '',
ALTER COLUMN "citySearch" SET NOT NULL;

-- The old indexes on `city` and `neighborhood` stay for now: the previous app filters on those
-- columns while the new one is being deployed. A follow-up migration, once this app is live, drops
-- them, backfills again the rows the previous app created with `citySearch = ''` and removes the
-- DEFAULT.

-- CreateIndex
CREATE INDEX "Property_citySearch_idx" ON "Property"("citySearch");

-- CreateIndex
CREATE INDEX "Property_neighborhoodSearch_idx" ON "Property"("neighborhoodSearch");
