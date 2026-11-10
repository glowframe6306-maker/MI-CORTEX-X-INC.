'use strict';

const { upload } = require('@vercel/blob/client');

window.careersPrivateUpload = (file, batchId, documentId) => upload(
  `private-careers/${batchId}/${documentId}.pdf`,
  file,
  {
    access: 'private',
    handleUploadUrl: '/api/careers/uploads',
    clientPayload: JSON.stringify({ batchId, documentId, name: file.name }),
    multipart: true
  }
);
