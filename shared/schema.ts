import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, date as pgDate } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const produitEnum = z.enum(["Gazoil", "Essence", "Jet A1"]);
export type Produit = z.infer<typeof produitEnum>;

export const statutEnum = z.enum(["En cours", "Livré", "Non livré"]);
export type Statut = z.infer<typeof statutEnum>;

export const commandes = pgTable("commandes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  client: text("client").notNull(),
  numeroBonCommande: text("numero_bon_commande").notNull(),
  dateLivraison: pgDate("date_livraison").notNull(),
  depot: text("depot").notNull(),
  camion: text("camion").notNull(),
  quantite: decimal("quantite", { precision: 10, scale: 2 }).notNull(),
  produit: text("produit").notNull(),
  fournisseur: text("fournisseur").notNull(),
  dateChargement: pgDate("date_chargement").notNull(),
  statut: text("statut").notNull(),
  transporteur: text("transporteur").notNull(),
  destination: text("destination").notNull(),
  tauxTransport: decimal("taux_transport", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommandeSchema = createInsertSchema(commandes, {
  client: z.string().min(1, "Le client est requis"),
  numeroBonCommande: z.string().min(1, "Le numéro de bon de commande est requis"),
  dateLivraison: z
    .string({ required_error: "La date de livraison est requise" })
    .refine((value) => !Number.isNaN(Date.parse(value)), "Date de livraison invalide")
    .transform((value) => value),
  depot: z.string().min(1, "Le dépôt est requis"),
  camion: z.string().min(1, "Le camion est requis"),
  quantite: z.coerce.number().positive("La quantité doit être positive"),
  produit: produitEnum,
  fournisseur: z.string().min(1, "Le fournisseur est requis"),
  dateChargement: z
    .string({ required_error: "La date de chargement est requise" })
    .refine((value) => !Number.isNaN(Date.parse(value)), "Date de chargement invalide")
    .transform((value) => value),
  statut: statutEnum,
  transporteur: z.string().min(1, "Le transporteur est requis"),
  destination: z.string().min(1, "La destination est requise"),
  tauxTransport: z.coerce.number().positive("Le taux de transport doit être positif"),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCommande = z.infer<typeof insertCommandeSchema>;
export type Commande = typeof commandes.$inferSelect;


