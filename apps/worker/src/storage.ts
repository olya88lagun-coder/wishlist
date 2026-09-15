import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type S3Config = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string };

export type ObjectStorage = {
  put(bucket: string, key: string, body: Uint8Array, options: { contentType: string; cacheControl?: string }): Promise<void>;
  list(bucket: string, prefix: string): Promise<string[]>;
  remove(bucket: string, keys: string[]): Promise<void>;
};

export function createS3Storage(config: S3Config): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Новые SDK по умолчанию добавляют CRC32-заголовки, которые S3-совместимые хранилища могут отвергать
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    async put(bucket, key, body, options) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: options.contentType, CacheControl: options.cacheControl }));
    },
    async list(bucket, prefix) {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    async remove(bucket, keys) {
      if (keys.length === 0) return;
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
    },
  };
}
