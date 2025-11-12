import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.warn("DATABASE_URL is not set. Please configure Neon connection string in your environment.");
}

const sql = neon(databaseUrl || "");
export const db = drizzle(sql);


