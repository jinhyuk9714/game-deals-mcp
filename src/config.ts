import { z } from "zod";

const envSchema = z.object({
  ITAD_API_KEY: z.string().min(1).optional(),
  RAWG_API_KEY: z.string().min(1).optional()
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}
