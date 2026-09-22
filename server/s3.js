import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || 'ap-south-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ronav-media-storage-688927';
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
  const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    bucket: bucketName,
    region,
  };
}

/**
 * Direct buffer upload from server to S3
 */
export async function uploadBufferToS3(buffer, key, contentType = 'application/octet-stream') {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
  return {
    key,
    publicUrl: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
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
