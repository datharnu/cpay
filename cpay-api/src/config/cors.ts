import type { CorsOptions } from "cors";
import { env } from "./env";

function isVercelOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (env.corsOrigins.includes(origin)) return true;
  if (env.corsAllowVercel && isVercelOrigin(origin)) return true;
  return false;
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }
    console.warn("[cors] blocked origin:", origin);
    callback(null, false);
  },
};
