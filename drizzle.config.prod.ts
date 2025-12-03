import { defineConfig } from "drizzle-kit";

// This config is used by GitHub Actions for production migrations
// It only requires DATABASE_URL to be set
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

