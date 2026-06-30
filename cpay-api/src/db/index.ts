import { Sequelize } from "sequelize";
import { env } from "../config/env";

export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: env.databaseUrl,
  logging: false,
});
