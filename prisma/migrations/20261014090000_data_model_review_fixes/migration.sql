-- Added by hand: Prisma doesn't create extensions. citext makes city comparisons case-insensitive
-- while still using a plain btree index.
CREATE EXTENSION IF NOT EXISTS citext;

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_propertyId_fkey";

-- DropIndex
DROP INDEX "Property_publishedAt_idx";

-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "city" SET DATA TYPE CITEXT;

-- CreateIndex
CREATE INDEX "Property_status_publishedAt_id_idx" ON "Property"("status", "publishedAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Property_id_ownerId_key" ON "Property"("id", "ownerId");

-- Added by hand: align existing conversations with the listing owner before the composite FK.
UPDATE "Conversation" AS c
SET "advertiserId" = p."ownerId"
FROM "Property" AS p
WHERE c."propertyId" = p."id" AND c."advertiserId" <> p."ownerId";

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_propertyId_advertiserId_fkey" FOREIGN KEY ("propertyId", "advertiserId") REFERENCES "Property"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
