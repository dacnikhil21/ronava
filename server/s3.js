import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { recordMediaFile } from './pg_db.js';

const region = process.env.AWS_REGION || 'ap-south-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ronav-media-storage-688927';
const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN || 'd1rqftl6szhydo.cloudfront.net';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

let s3Client = null;

export function getS3Client() {
  if (!s3Client) {
    if (!accessKeyId || !secretAccessKey) {
      console.warn('[AWS S3] Credentials not fully configured in environment variables.');
    }
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Helper to get CDN URL from S3 key
 */
export function getCdnUrl(key) {
  return cloudFrontDomain ? `https://${cloudFrontDomain}/${key}` : `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Verify S3 bucket connection and access
 */
export async function verifyS3Connection() {
  try {
    const client = getS3Client();
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1,
    });
    const res = await client.send(command);
    return {
      success: true,
      bucket: bucketName,
      region,
      cloudFrontDomain,
      keyCount: res.KeyCount || 0,
    };
  } catch (error) {
    console.error('[AWS S3 Connection Error]:', error.message);
    return {
      success: false,
      error: error.message,
      bucket: bucketName,
      region,
    };
  }
}

/**
 * Generate a pre-signed URL for direct browser-to-S3 upload
 */
export async function getPresignedUploadUrl(fileName, contentType = 'application/octet-stream', folder = 'uploads') {
  const client = getS3Client();
  const safeName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folder}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 }); // 15 mins
  const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  const cdnUrl = getCdnUrl(key);

  return {
    uploadUrl,
    s3Url,
    cdnUrl,
    publicUrl: cdnUrl,
    key,
    bucket: bucketName,
    region,
  };
}

/**
 * Direct buffer upload from server to S3 and auto-record in media relational table
 */
export async function uploadBufferToS3(buffer, key, contentType = 'application/octet-stream', meta = {}) {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);

  const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  const cdnUrl = getCdnUrl(key);

  // Auto-record relational metadata
  let dbRecord = null;
  try {
    dbRecord = await recordMediaFile({
      merchant_id: meta.merchant_id || null,
      file_name: meta.fileName || key.split('/').pop(),
      s3_key: key,
      s3_url: s3Url,
      cdn_url: cdnUrl,
      mime_type: contentType,
      file_size_bytes: buffer.length || 0,
      entity_type: meta.entity_type || 'GENERAL',
      entity_id: meta.entity_id || null,
    });
  } catch (e) {
    console.warn('[Media DB Record Error]:', e.message);
  }

  return {
    key,
    s3Url,
    cdnUrl,
    publicUrl: cdnUrl,
    dbRecord,
  };
}

/**
 * Delete an object from S3
 */
export async function deleteS3Object(key) {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  await client.send(command);
  return { success: true, key };
}

