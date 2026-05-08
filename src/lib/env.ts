import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  AUTH_SECRET: z.string(),
  CLAUDE_API_KEY: z.string().optional(),
  JIMENG_API_KEY: z.string().optional(),
  KLING_API_KEY: z.string().optional(),
  TTS_API_KEY: z.string().optional(),
  DOUYIN_CLIENT_ID: z.string().optional(),
  DOUYIN_CLIENT_SECRET: z.string().optional(),
  KUAISHOU_CLIENT_ID: z.string().optional(),
  KUAISHOU_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
