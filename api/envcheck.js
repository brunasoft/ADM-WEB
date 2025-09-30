// api/envcheck.js
export default function handler(req, res) {
  res.status(200).json({
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_POSTGRES_URL: !!process.env.POSTGRES_URL,
    has_NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
    has_POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    has_MIGRATE_TOKEN: !!process.env.MIGRATE_TOKEN,
    node_env: process.env.NODE_ENV
  });
}
