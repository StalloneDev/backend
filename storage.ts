import { db } from "./db";
import { commandes, users, type User, type InsertUser, type Commande, type InsertCommande } from "./shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllCommandes(): Promise<Commande[]>;
  getCommande(id: string): Promise<Commande | undefined>;
  createCommande(commande: InsertCommande): Promise<Commande>;
  updateCommande(id: string, commande: InsertCommande): Promise<Commande | undefined>;
  deleteCommande(id: string): Promise<boolean>;
}

export class PgStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const rows = await db.insert(users).values(insertUser).returning();
    return rows[0]!;
  }

  async getAllCommandes(): Promise<Commande[]> {
    const rows = await db.select().from(commandes).orderBy(desc(commandes.createdAt));
    return rows;
  }

  async getCommande(id: string): Promise<Commande | undefined> {
    const rows = await db.select().from(commandes).where(eq(commandes.id, id)).limit(1);
    return rows[0];
  }

  async createCommande(insertCommande: InsertCommande): Promise<Commande> {
    const rows = await db.insert(commandes).values(insertCommande).returning();
    return rows[0]!;
  }

  async updateCommande(id: string, insertCommande: InsertCommande): Promise<Commande | undefined> {
    const rows = await db.update(commandes).set(insertCommande).where(eq(commandes.id, id)).returning();
    return rows[0];
  }

  async deleteCommande(id: string): Promise<boolean> {
    const rows = await db.delete(commandes).where(eq(commandes.id, id)).returning({ id: commandes.id });
    return rows.length > 0;
  }

  async initSuperAdmin() {
    const existing = await this.getUserByUsername("Superadmin");
    if (existing) return;

    const bcryptModule = await import("bcryptjs");
    const bcrypt: any = (bcryptModule as any).default ?? bcryptModule;
    const hashedPassword = await bcrypt.hash("Administrator", 10);
    await this.createUser({
      username: "Superadmin",
      password: hashedPassword,
    });
  }
}

export const storage = new PgStorage();

(async () => {
  try {
    await storage.initSuperAdmin();
  } catch (e) {
    console.warn("Superadmin seed skipped (database not reachable yet).", e);
  }
})();


