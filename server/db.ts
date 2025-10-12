import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;

// Detect if we're using Neon (WebSocket-based) or standard PostgreSQL
const isNeonDatabase = databaseUrl.includes('neon.tech') || databaseUrl.includes('neon.database');

let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof postgresDrizzle>;
let pool: NeonPool | ReturnType<typeof postgres>;

if (isNeonDatabase) {
  // Neon environment (Replit) - use WebSocket-based driver
  console.log('Using Neon PostgreSQL driver (WebSocket)');
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = neonDrizzle({ client: pool as NeonPool, schema });
} else {
  // Local Docker or standard PostgreSQL - use TCP-based driver
  console.log('Using standard PostgreSQL driver (TCP)');
  const client = postgres(databaseUrl);
  pool = client;
  db = postgresDrizzle({ client, schema });
}

export { db, pool };
