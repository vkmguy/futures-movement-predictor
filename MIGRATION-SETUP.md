# Database Migration Setup Guide

## Overview

This guide walks you through setting up proper database migrations for the Futures Movement Predictor application. Migrations ensure that database schema changes are version-controlled, reproducible, and safely applied across all environments.

## ✅ What's Already Done

The following migration infrastructure has been set up for you:

1. ✅ **Migration runner script** (`server/migrate.ts`)
2. ✅ **Initial migration files** generated in `./migrations/`
3. ✅ **Docker configuration** updated to run migrations on startup
4. ✅ **Documentation** updated in `DOCKER-DEPLOYMENT.md`

## 📝 Manual Steps Required

### Step 1: Update `package.json`

Add the following two scripts to your `package.json` file in the `"scripts"` section:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",        // ← ADD THIS LINE
    "db:migrate": "tsx server/migrate.ts"         // ← ADD THIS LINE
  }
}
```

**What these scripts do:**

- `db:generate` - Generates SQL migration files from schema changes
- `db:migrate` - Applies pending migrations to the database

### Step 2: Test the Migration System

After updating `package.json`, verify the migration system works:

#### Option A: Test with Replit Database (Neon)

```bash
# Apply migrations to your Replit database
npm run db:migrate
```

You should see:
```
🔄 Starting database migrations...
✅ Migrations completed successfully
```

#### Option B: Test with Local Docker

```bash
# Start Docker services (migrations run automatically)
docker-compose up -d

# Check migration logs
docker-compose logs migrations

# Should show successful migration completion
```

### Step 3: Verify Database Schema

After running migrations, verify all tables were created:

```bash
# For Replit database - use the Database pane in Replit UI

# For Docker - connect to PostgreSQL
docker-compose exec postgres psql -U futures -d futures_db -c "\dt"
```

You should see 9 tables:
- `daily_iv_history`
- `daily_predictions`
- `futures_contracts`
- `historical_daily_expected_moves`
- `historical_prices`
- `iv_updates`
- `price_alerts`
- `weekly_expected_moves`
- `weekly_iv_overrides` ← **This was missing before!**

## 🔄 Migration Workflow (Going Forward)

### Making Schema Changes

1. **Edit the schema** (`shared/schema.ts`)
   ```typescript
   // Example: Add a new table or column
   export const myNewTable = pgTable("my_new_table", {
     id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
     name: text("name").notNull(),
   });
   ```

2. **Generate migration**
   ```bash
   npm run db:generate
   ```
   This creates a new SQL file in `./migrations/` (e.g., `0001_fancy_spider.sql`)

3. **Review the migration**
   ```bash
   cat migrations/0001_fancy_spider.sql
   ```
   Ensure the generated SQL looks correct

4. **Apply migration**
   ```bash
   npm run db:migrate
   ```

5. **Commit changes**
   ```bash
   git add shared/schema.ts
   git add migrations/
   git commit -m "Add new table for feature X"
   ```

### Docker Deployment

Migrations run automatically when you deploy:

```bash
docker-compose up -d
```

The workflow:
1. PostgreSQL starts and waits for health check
2. Migrations service runs `npm run db:migrate`
3. Web and scheduler services start after migrations complete

## 🚨 Important Migration Best Practices

### ✅ DO:
- Always generate migrations for schema changes
- Commit migration files to version control
- Test migrations locally before deploying
- Review generated SQL before applying
- Backup database before production migrations

### ❌ DON'T:
- Don't edit existing migration files after they're applied
- Don't skip migrations or delete migration files
- Don't use `db:push` in production (development only)
- Don't change primary key types (serial ↔ varchar)

## 🐛 Troubleshooting

### Migration Fails with "Table already exists"

This means the table was created with `db:push` but migrations think it's new.

**Solution:**
```bash
# Option 1: Reset migrations (development only!)
docker-compose down -v  # Deletes all data!
docker-compose up -d

# Option 2: Manually mark migration as applied
# (Advanced - consult Drizzle documentation)
```

### Missing `weekly_iv_overrides` table in Docker

This is what you're experiencing now! The table exists in schema but not in database.

**Solution:**
```bash
# After updating package.json
npm run db:migrate

# Or with Docker
docker-compose down
docker-compose up -d  # Migrations run on startup
```

### Different database drivers (Neon vs local PostgreSQL)

The migration script (`server/migrate.ts`) uses the standard `postgres` driver, which works with both:
- **Neon databases** (used in Replit)
- **Local PostgreSQL** (used in Docker)

No changes needed - it's environment-aware!

## 📚 Additional Resources

- [Drizzle Migrations Documentation](https://orm.drizzle.team/docs/migrations)
- [DOCKER-DEPLOYMENT.md](./DOCKER-DEPLOYMENT.md) - Full Docker deployment guide
- [Drizzle Kit Commands](https://orm.drizzle.team/kit-docs/overview)

## 🎯 Quick Reference

```bash
# Generate migration after schema change
npm run db:generate

# Apply migrations
npm run db:migrate

# Development only: Force push schema (no migrations)
npm run db:push

# Docker: View migration logs
docker-compose logs migrations

# Docker: Manually run migrations
docker-compose run --rm migrations npm run db:migrate
```

---

**Next Steps:** After updating `package.json`, run `npm run db:migrate` to create the missing `weekly_iv_overrides` table in your local Docker database!
