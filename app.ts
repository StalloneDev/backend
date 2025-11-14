import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
// @ts-expect-error: No type declarations for connect-pg-simple
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import path from "path";
import { registerRoutes } from "./routes.js";
import cors from "cors";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const PgStore = connectPgSimple(session);

const corsOriginsRaw = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = corsOriginsRaw.includes("*");

const pgPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "off" ? false : { rejectUnauthorized: false },
    })
  : undefined;

let sessionStore: session.Store | undefined;

if (pgPool) {
  sessionStore = new PgStore({
    pool: pgPool,
    tableName: "user_sessions",
    createTableIfMissing: true,
    schemaName: "public",
  });
  sessionStore!.on("connect-error", (err) => {
    console.error("Session store connection error:", err);
  });
  sessionStore!.on("error", (err) => {
    console.error("Session store error:", err);
  });
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: allowAllOrigins ? true : corsOriginsRaw,
      credentials: true,
    }),
  );

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "suivi-chargements-secret-key-2025",
      resave: false,
      saveUninitialized: false,
      store: sessionStore ?? new session.MemoryStore(),
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    }),
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  app.use("/public", express.static(path.join(process.cwd(), "public")));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const requestPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (requestPath.startsWith("/api")) {
        let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 120) {
          logLine = `${logLine.slice(0, 119)}…`;
        }
        console.log(logLine);
      }
    });

    next();
  });

  registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }
  });

  return app;
}

export const app = createApp();


