import type { Express } from "express";
import { storage } from "./storage";
import { insertCommandeSchema } from "./shared/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { startOfMonth, endOfMonth } from "date-fns";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function registerRoutes(app: Express): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  app.get("/api/commandes", requireAuth, async (_req, res) => {
    try {
      const commandes = await storage.getAllCommandes();
      res.json(commandes);
    } catch (error) {
      console.error("Get commandes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/commandes/:id", requireAuth, async (req, res) => {
    try {
      const commande = await storage.getCommande(req.params.id);

      if (!commande) {
        return res.status(404).json({ message: "Commande not found" });
      }

      res.json(commande);
    } catch (error) {
      console.error("Get commande error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/commandes", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCommandeSchema.parse(req.body);
      const commande = await storage.createCommande(validatedData);
      res.status(201).json(commande);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Create commande error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/commandes/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCommandeSchema.parse(req.body);
      const commande = await storage.updateCommande(req.params.id, validatedData);

      if (!commande) {
        return res.status(404).json({ message: "Commande not found" });
      }

      res.json(commande);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Update commande error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/commandes/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCommande(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: "Commande not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete commande error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats", requireAuth, async (_req, res) => {
    try {
      const commandes = await storage.getAllCommandes();
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const currentMonthCommandes = commandes.filter((cmd) => {
        const date = new Date(cmd.dateChargement as unknown as string);
        return !Number.isNaN(date.getTime()) && date >= monthStart && date <= monthEnd;
      });

      const totalCommandes = currentMonthCommandes.length;

      const totalQuantite = currentMonthCommandes.reduce(
        (sum, cmd) => {
          const qty = typeof cmd.quantite === 'string' ? parseFloat(cmd.quantite) : Number(cmd.quantite);
          return sum + (isNaN(qty) ? 0 : qty);
        },
        0
      );

      const quantiteParProduit = currentMonthCommandes.reduce((acc, cmd) => {
        const produit = cmd.produit;
        const qty = typeof cmd.quantite === 'string' ? parseFloat(cmd.quantite) : Number(cmd.quantite);
        acc[produit] = (acc[produit] || 0) + (isNaN(qty) ? 0 : qty);
        return acc;
      }, {} as Record<string, number>);

      const commandesParClient = currentMonthCommandes.reduce((acc, cmd) => {
        acc[cmd.client] = (acc[cmd.client] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const clientsEntries = Object.entries(commandesParClient).sort((a, b) => b[1] - a[1]);
      const meilleurClient = clientsEntries[0]?.[0] || "N/A";
      const meilleurClientCommandes = clientsEntries[0]?.[1] || 0;
      const moinsClient = clientsEntries.length > 1 
        ? clientsEntries[clientsEntries.length - 1]?.[0] 
        : (clientsEntries.length === 1 ? clientsEntries[0]?.[0] : "N/A");
      const moinsClientCommandes = clientsEntries.length > 1 
        ? clientsEntries[clientsEntries.length - 1]?.[1] 
        : (clientsEntries.length === 1 ? clientsEntries[0]?.[1] : 0);

      const livraisonsParTransporteur = currentMonthCommandes
        .filter((cmd) => cmd.statut === "Livré")
        .reduce((acc, cmd) => {
          acc[cmd.transporteur] = (acc[cmd.transporteur] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const transporteursEntries = Object.entries(livraisonsParTransporteur).sort((a, b) => b[1] - a[1]);
      const meilleurTransporteur = transporteursEntries[0]?.[0] || "N/A";
      const meilleurTransporteurLivraisons = transporteursEntries[0]?.[1] || 0;

      const quantiteParDepot = currentMonthCommandes.reduce((acc, cmd) => {
        const qty = typeof cmd.quantite === 'string' ? parseFloat(cmd.quantite) : Number(cmd.quantite);
        acc[cmd.depot] = (acc[cmd.depot] || 0) + (isNaN(qty) ? 0 : qty);
        return acc;
      }, {} as Record<string, number>);

      const depotsEntries = Object.entries(quantiteParDepot).sort((a, b) => b[1] - a[1]);
      const depotPlusActif = depotsEntries[0]?.[0] || "N/A";
      const depotPlusActifQuantite = depotsEntries[0]?.[1] || 0;

      res.json({
        totalCommandes,
        totalQuantite: Math.round(totalQuantite),
        quantiteParProduit,
        meilleurClient,
        meilleurClientCommandes,
        moinsClient,
        moinsClientCommandes,
        meilleurTransporteur,
        meilleurTransporteurLivraisons,
        depotPlusActif,
        depotPlusActifQuantite: Math.round(depotPlusActifQuantite),
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });
}


