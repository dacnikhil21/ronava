import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'ap-south-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ronav-media-storage-688927';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
};

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

async function deploy() {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Please run `npm run build` first.');
    process.exit(1);
  }

  const files = getAllFiles(distDir);
  console.log(`\n🚀 Starting AWS S3 Push to [${bucketName}] (${files.length} files)...\n`);

  let successCount = 0;
  for (const filePath of files) {
    const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileContent = fs.readFileSync(filePath);

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: relativePath,
        Body: fileContent,
        ContentType: contentType,
        CacheControl: ext === '.html' ? 'no-cache' : 'max-age=31536000',
      }));
      console.log(`  ✓ Uploaded: ${relativePath} (${contentType})`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Failed to upload ${relativePath}:`, err.message);
    }
  }

  console.log(`\n✨ S3 Deployment Complete! ${successCount}/${files.length} files pushed successfully.`);
  console.log(`🌐 S3 Bucket URL: https://${bucketName}.s3.${region}.amazonaws.com/index.html\n`);
}

deploy();
