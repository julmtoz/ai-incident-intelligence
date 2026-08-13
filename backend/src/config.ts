import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  GITHUB_TOKEN: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  BODY_LIMIT: z.string().default("16kb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  SUBMISSION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  STATIC_DIR: z.string().default("../frontend/dist"),
  TRUST_PROXY: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
