const { uploadLocalFileToBlob } = require('../lib/vercel-blob');
const { join } = require('path');

async function uploadVideos() {
  const videos = [
    'pulsechain-ai .mp4',
    'ai-agentbackground.mp4',
    'hexx.mp4',
    'hexx2.mp4',
    'hexx3.mp4'
  ];

  console.log('Uploading videos to Vercel Blob...\n');

  for (const video of videos) {
    try {
      const filePath = join(process.cwd(), 'public', video);
      console.log(`Uploading ${video}...`);
      
      const result = await uploadLocalFileToBlob(filePath, video);
      
      console.log(`✅ ${video}: ${result.url}`);
      console.log(`   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Content Type: ${result.contentType}\n`);
      
    } catch (error) {
      console.error(`❌ Failed to upload ${video}:`, error);
    }
  }
}

uploadVideos().catch(console.error);
