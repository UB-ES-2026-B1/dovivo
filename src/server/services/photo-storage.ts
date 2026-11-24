import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

/**
 * Photo storage (US-18, T-10): an S3-compatible bucket (RustFS locally, S3 or R2 in production).
 * The browser uploads each file straight to the bucket with a short-lived signed URL, so photos
 * never go through our server on the way in (tRPC has no multipart). The bucket must allow
 * public reads (photos are public, as the listings) and, in production, CORS `PUT` from the app.
 *
 * Kept behind this small interface so the router can be tested with a fake.
 */
export type PhotoStorage = {
  /** Signed URL to `PUT` exactly this file: type and size are part of the signature. */
  createUploadUrl(input: {
    key: string;
    contentType: string;
    contentLength: number;
  }): Promise<{ url: string; expiresAt: Date }>;
  /** Size in bytes of an uploaded object, or `null` if it doesn't exist. */
  sizeOf(key: string): Promise<number | null>;
  download(key: string): Promise<Buffer>;
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Deletes the objects; missing ones are ignored. */
  remove(keys: string[]): Promise<void>;
};

/** Time the browser has to start the upload after asking for the URL. */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

export function createS3PhotoStorage(client: S3Client, bucket: string) {
  return {
    async createUploadUrl({ key, contentType, contentLength }) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        // Signed, so the storage rejects a file of another size or type than the one validated.
        signableHeaders: new Set(["content-type", "content-length"]),
      });
      return {
        url,
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
      };
    },

    async sizeOf(key) {
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return head.ContentLength ?? 0;
      } catch (error) {
        if (
          error instanceof NotFound ||
          (error instanceof S3ServiceException &&
            error.$metadata.httpStatusCode === 404)
        ) {
          return null;
        }
        throw error;
      }
    },

    async download(key) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!object.Body) throw new Error(`Empty object: ${key}`);
      return Buffer.from(await object.Body.transformToByteArray());
    },

    async upload(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Keys are never reused (a new uuid per photo), so browsers and CDNs can keep them.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },

    async remove(keys) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    },
  } satisfies PhotoStorage;
}

let cached: PhotoStorage | null | undefined;

/**
 * The storage configured in the env, or `null` when `S3_BUCKET` (or the keys) are missing, e.g.
 * on a machine that hasn't set it up: the rest of the app works, only photos are unavailable.
 */
export function getPhotoStorage(): PhotoStorage | null {
  if (cached !== undefined) return cached;

  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    cached = null;
    return cached;
  }

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    // With `SKIP_ENV_VALIDATION` zod doesn't run, so `env` holds the raw strings: no default and
    // "true" instead of `true`. Read both values so they work either way.
    region: env.S3_REGION || "us-east-1",
    forcePathStyle: String(env.S3_FORCE_PATH_STYLE) === "true",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
  cached = createS3PhotoStorage(client, S3_BUCKET);
  return cached;
}
