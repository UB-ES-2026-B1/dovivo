/**
 * Prepares the photo bucket (US-18) with the S3_* variables of `.env`: creates it if it doesn't
 * exist, lets anyone read the photos (they are public, as the listings) and allows the browser to
 * upload with the signed URLs (CORS). Safe to run again.
 *
 *   pnpm storage:up      # local S3 (RustFS) in Docker
 *   pnpm storage:setup   # this script
 *
 * Works with any S3-compatible service. Some (e.g. Cloudflare R2) configure public access in their
 * dashboard instead: the script then only warns.
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}: copy it from .env.example into .env.`);
    process.exit(1);
  }
  return value;
}

/** An empty value in `.env` ("leave it empty for AWS S3") means "not set", as in `src/env.js`. */
function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === "" ? undefined : value;
}

const bucket = required("S3_BUCKET");
// Origins allowed to upload from the browser. Comma-separated, e.g. the staging URL.
const origins = (process.env.S3_CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const client = new S3Client({
  endpoint: optional("S3_ENDPOINT"),
  region: optional("S3_REGION") ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
});

async function step(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    console.log(`✔ ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠ ${label}: ${message}`);
  }
}

async function main() {
  const exists = await client
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .then(() => true)
    .catch(() => false);
  if (exists) {
    console.log(`✔ Bucket "${bucket}" already exists`);
  } else {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✔ Bucket "${bucket}" created`);
  }

  await step("Public read access for photos", () =>
    client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    ),
  );

  await step(`Browser uploads from ${origins.join(", ")}`, () =>
    client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["PUT", "GET"],
              AllowedHeaders: ["*"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
