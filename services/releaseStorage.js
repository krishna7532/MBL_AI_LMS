'use strict';

const { randomUUID } = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Validates and returns AWS S3 region and bucket configuration
function getS3Config() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!region) throw new Error('AWS_REGION is required');
  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME is required');
  return { region, bucket };
}

// Uploads a release package archive to S3 bucket and returns the storage key
async function saveReleaseArchive(buffer, releaseId, version, originalFilename) {
  const { region, bucket } = getS3Config();
  const s3 = new S3Client({ region });

  const extension = originalFilename.toLowerCase().endsWith('.json') ? 'json' : 'zip';
  const key = `releases/${randomUUID()}.${extension}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentLength: buffer.length,
    ContentType: extension === 'json' ? 'application/json' : 'application/zip',
    Metadata: {
      'release-id': releaseId,
      version: String(version),
    },
  }));

  return key;
}

// Deletes an uploaded release archive from S3 if database import fails
async function deleteReleaseArchive(key) {
  const { region, bucket } = getS3Config();
  const s3 = new S3Client({ region });

  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
}

module.exports = { saveReleaseArchive, deleteReleaseArchive };
