-- WARNING: This migration will fail if there are any existing 'non binary' values in the users table
-- If there are, you'll need to manually update them first

-- Step 1: Create a new enum type with only the values we want
CREATE TYPE "public"."gender_new" AS ENUM('male', 'female', 'prefer not to say');

-- Step 2: Alter the users table to use the new enum type
-- This will fail if any rows have 'non binary' value
ALTER TABLE "users" 
  ALTER COLUMN "gender" TYPE "gender_new" 
  USING "gender"::text::"gender_new";

-- Step 3: Drop the old enum type
DROP TYPE "public"."gender";

-- Step 4: Rename the new enum to the original name
ALTER TYPE "public"."gender_new" RENAME TO "gender";

