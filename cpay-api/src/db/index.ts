import { Sequelize } from "sequelize";
import { env } from "../config/env";

export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: env.databaseUrl,
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

export async function configureSqlite(): Promise<void> {
  if (sequelize.getDialect() !== "sqlite") return;

  await sequelize.query("PRAGMA journal_mode = WAL;");
  await sequelize.query("PRAGMA busy_timeout = 10000;");
  await sequelize.query("PRAGMA synchronous = NORMAL;");
}
