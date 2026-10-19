-- Added by hand: citext is also created by 20261014090000_data_model_review_fixes; repeated here so
-- this migration doesn't depend on it.
CREATE EXTENSION IF NOT EXISTS citext;

-- Added by hand: accounts whose emails differ only in case would break the unique index below.
-- They can't be merged automatically, so fail with a clear message instead of a bare unique error.
DO $$
DECLARE
    duplicates TEXT;
BEGIN
    SELECT string_agg("lowerEmail", ', ') INTO duplicates
    FROM (
        SELECT lower("email") AS "lowerEmail"
        FROM "User"
        WHERE "email" IS NOT NULL
        GROUP BY lower("email")
        HAVING count(*) > 1
    ) AS dup;

    IF duplicates IS NOT NULL THEN
        RAISE EXCEPTION 'Users with the same email in different case: %. Merge or delete them first.', duplicates;
    END IF;
END $$;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE CITEXT;
