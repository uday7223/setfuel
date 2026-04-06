import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};
