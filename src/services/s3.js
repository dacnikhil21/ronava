/**
 * RONAV S3 Storage Client Helper
 * Supports direct presigned uploads (Browser -> S3) and Base64 uploads (via Backend API)
 */

export async function checkS3Status() {
  try {
    const res = await fetch('/api/s3/status');
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Upload a File object directly to AWS S3 using a Presigned URL
 * @param {File} file - The file to upload
 * @param {string} folder - Folder name in S3 ('kyc', 'receipts', 'documents', 'avatars')
 * @param {function} onProgress - Optional callback for upload progress
 * @returns {Promise<{ publicUrl: string, key: string }>}
 */
export async function uploadFileToS3(file, folder = 'documents', onProgress = null) {
  if (!file) throw new Error('No file provided for upload.');

  // 1. Get presigned upload URL from backend
  const presignedRes = await fetch('/api/s3/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      folder,
    }),
  });

  const presignedData = await presignedRes.json();
  if (!presignedData.success || !presignedData.uploadUrl) {
    // Fallback: If direct presigned fails, upload via base64 API route
    return uploadFileViaBase64(file, folder);
  }

  // 2. Direct PUT to S3 using the presigned URL
  const uploadRes = await fetch(presignedData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadRes.ok) {
    // Fallback if CORS blocked direct PUT
    console.warn('Presigned PUT failed, falling back to server base64 upload...');
    return uploadFileViaBase64(file, folder);
  }

  return {
    publicUrl: presignedData.publicUrl,
    key: presignedData.key,
  };
}

/**
 * Fallback upload method converting file to Base64 and sending to server
 */
export async function uploadFileViaBase64(file, folder = 'documents') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const res = await fetch('/api/s3/upload-base64', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            fileName: file.name,
            contentType: file.type,
            folder,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to upload file to S3.');
        }
        resolve({
          publicUrl: data.publicUrl,
          key: data.key,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Delete a file from S3 by key
 */
export async function deleteFileFromS3(key) {
  const res = await fetch('/api/s3/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  return await res.json();
}
