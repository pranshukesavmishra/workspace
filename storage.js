// Optional cloud storage (any S3-compatible bucket: Cloudflare R2, Supabase Storage, AWS S3, Backblaze B2, MinIO…).
//
// Free hosts such as Render's free plan have no permanent disk: every restart starts empty.
// With a bucket configured, every uploaded file is stored in the bucket, and the database is
// copied there a few seconds after every change (plus one snapshot per day), then restored on start.
import { AwsClient } from 'aws4fetch';

export function createStorage(env) {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  const client = new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    service: 's3',
    region: env.S3_REGION || 'auto',
    retries: 3,
  });
  const base = `${S3_ENDPOINT.replace(/\/+$/, '')}/${encodeURIComponent(S3_BUCKET)}/`;
  const prefix = env.S3_PREFIX ?? 'workspace/';
  const url = (key) => base + (prefix + key).split('/').map(encodeURIComponent).join('/');
  const fail = async (op, key, r) => {
    throw new Error(`Storage ${op} ${key} failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`);
  };

  return {
    describe: `bucket "${S3_BUCKET}" at ${new URL(S3_ENDPOINT).host}`,
    async put(key, body, contentType = 'application/octet-stream') {
      const r = await client.fetch(url(key), { method: 'PUT', body, headers: { 'content-type': contentType } });
      if (!r.ok) await fail('upload', key, r);
    },
    /** Returns a Buffer, or null if the object does not exist. Throws on any other error. */
    async get(key) {
      const r = await client.fetch(url(key));
      if (r.status === 404) return null;
      if (!r.ok) await fail('download', key, r);
      return Buffer.from(await r.arrayBuffer());
    },
    async del(key) {
      const r = await client.fetch(url(key), { method: 'DELETE' });
      if (!r.ok && r.status !== 404) await fail('delete', key, r);
    },
  };
}
