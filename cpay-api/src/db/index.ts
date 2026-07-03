import { Sequelize } from "sequelize";
import { env } from "../config/env";

const databaseUrl = env.databaseUrl;
const isPostgres =
  databaseUrl.startsWith("postgres://") ||
  databaseUrl.startsWith("postgresql://");

export const dbKind = isPostgres ? "postgres" : "sqlite";
export const isDurableDatabase = isPostgres || databaseUrl.startsWith("/var/data");

export const sequelize = isPostgres
  ? new Sequelize(databaseUrl, {
      dialect: "postgres",
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      pool: {
        max: 5,
        min: 0,
        idle: 10_000,
        acquire: 30_000,
      },
    })
  : new Sequelize({
      dialect: "sqlite",
      storage: databaseUrl,
      logging: false,
      pool: {
        max: 1,
        min: 0,
        idle: 10_000,
      },
      retry: {
        max: 5,
      },
    });

export async function configureDatabase(): Promise<void> {
  if (sequelize.getDialect() === "sqlite") {
    await sequelize.query("PRAGMA journal_mode = WAL;");
    await sequelize.query("PRAGMA busy_timeout = 10000;");
    await sequelize.query("PRAGMA synchronous = NORMAL;");
    return;
  }

  // Postgres (Neon): confirm connectivity early so boot fails clearly.
  await sequelize.authenticate();
}

/** @deprecated use configureDatabase */
export const configureSqlite = configureDatabase;
