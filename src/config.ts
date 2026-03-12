import { z } from "zod";

export type ConfigSource = Record<string, string | undefined>;

const envSchema = z.object({
  ITAD_API_KEY: z.string().min(1).optional(),
  RAWG_API_KEY: z.string().min(1).optional()
});

export function readConfig(env: ConfigSource = process.env) {
  return envSchema.parse(env);
}
