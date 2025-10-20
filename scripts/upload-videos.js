const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function uploadVideo(filePath, fileName) {
  try {
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    
    form.append('file', fileStream, fileName);
    
    const response = await fetch('http://localhost:3001/api/blob/upload', {
      method: 'POST',
      body: form,
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${fileName}: ${result.data.url}`);
      console.log(`   Size: ${(result.data.size / 1024 / 1024).toFixed(2)} MB`);
      return result.data.url;
    } else {
      console.error(`❌ Failed to upload ${fileName}:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    return null;
  }
}

async function uploadAllVideos() {
  const videos = [
    'pulsechain-ai .mp4',
    'ai-agentbackground.mp4',
    'hexx.mp4',
    'hexx2.mp4',
    'hexx3.mp4'
  ];

  console.log('Uploading videos to Vercel Blob...\n');

  const urls = {};
  
  for (const video of videos) {
    const filePath = path.join(__dirname, '..', 'public', video);
    
    if (fs.existsSync(filePath)) {
      const url = await uploadVideo(filePath, video);
      if (url) {
        urls[video] = url;
      }
    } else {
      console.error(`❌ File not found: ${filePath}`);
    }
  }

  console.log('\n📝 Update your video sources with these URLs:');
  console.log('=====================================');
  Object.entries(urls).forEach(([filename, url]) => {
    console.log(`${filename}: ${url}`);
  });
}

uploadAllVideos().catch(console.error);
