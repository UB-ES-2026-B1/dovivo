-- Search keys for the location filters (US-10). Written by hand: `citySearch` is required and the
-- table already has rows, so it is added as nullable, backfilled, then made NOT NULL.

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "citySearch" TEXT,
ADD COLUMN "neighborhoodSearch" TEXT;

-- Backfill with the same rules as `normalizeSearchText` (src/server/services/search-text.ts):
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

ALTER TABLE "Property" ALTER COLUMN "citySearch" SET NOT NULL;

-- Filters now use the search keys, so the old indexes on the display columns are unused.
-- DropIndex
DROP INDEX "Property_city_idx";

-- DropIndex
DROP INDEX "Property_neighborhood_idx";

-- CreateIndex
CREATE INDEX "Property_citySearch_idx" ON "Property"("citySearch");

-- CreateIndex
CREATE INDEX "Property_neighborhoodSearch_idx" ON "Property"("neighborhoodSearch");
