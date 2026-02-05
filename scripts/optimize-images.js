#!/usr/bin/env node
/**
 * Image Optimization Script
 * Converts images to WebP and AVIF formats with compression
 * Usage: node scripts/optimize-images.js
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, '../public/assets');
const OUTPUT_DIR = path.join(__dirname, '../public/assets/optimized');

// Optimization settings
const QUALITY = {
  webp: 85,
  avif: 75,
  jpeg: 85,
  png: 90
};

const SIZES = {
  // Multiple sizes for responsive images
  small: 640,
  medium: 1280,
  large: 1920,
  xlarge: 2560
};

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function optimizeImage(inputPath, filename) {
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, ext);
  
  console.log(`\n📸 Processing: ${filename}`);
  
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    console.log(`   Original: ${metadata.width}x${metadata.height}, ${(metadata.size / 1024).toFixed(2)}KB`);
    
    // Get original dimensions
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    
    // Process each size that's smaller than or equal to original
    for (const [sizeName, width] of Object.entries(SIZES)) {
      if (width > originalWidth) {
        console.log(`   ⏭️  Skipping ${sizeName} (${width}px) - larger than original`);
        continue;
      }
      
      const suffix = sizeName === 'large' && width >= originalWidth ? '' : `-${sizeName}`;
      
      // WebP
      const webpPath = path.join(OUTPUT_DIR, `${basename}${suffix}.webp`);
      await sharp(inputPath)
        .resize(width, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: QUALITY.webp, effort: 6 })
        .toFile(webpPath);
      
      const webpStats = await fs.stat(webpPath);
      console.log(`   ✅ WebP ${sizeName}: ${(webpStats.size / 1024).toFixed(2)}KB`);
      
      // AVIF (smaller but slower to encode)
      const avifPath = path.join(OUTPUT_DIR, `${basename}${suffix}.avif`);
      await sharp(inputPath)
        .resize(width, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .avif({ quality: QUALITY.avif, effort: 7 })
        .toFile(avifPath);
      
      const avifStats = await fs.stat(avifPath);
      console.log(`   ✅ AVIF ${sizeName}: ${(avifStats.size / 1024).toFixed(2)}KB`);
    }
    
    // Also create optimized original format as fallback
    const optimizedPath = path.join(OUTPUT_DIR, `${basename}${ext}`);
    if (ext === '.jpg' || ext === '.jpeg') {
      await sharp(inputPath)
        .jpeg({ quality: QUALITY.jpeg, mozjpeg: true })
        .toFile(optimizedPath);
    } else if (ext === '.png') {
      await sharp(inputPath)
        .png({ quality: QUALITY.png, compressionLevel: 9 })
        .toFile(optimizedPath);
    }
    
    const optimizedStats = await fs.stat(optimizedPath);
    console.log(`   ✅ Optimized ${ext}: ${(optimizedStats.size / 1024).toFixed(2)}KB`);
    
  } catch (error) {
    console.error(`   ❌ Error processing ${filename}:`, error.message);
  }
}

async function processDirectory() {
  console.log('🚀 Starting image optimization...\n');
  
  await ensureDir(OUTPUT_DIR);
  
  const files = await fs.readdir(INPUT_DIR);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  });
  
  if (imageFiles.length === 0) {
    console.log('No images found to optimize.');
    return;
  }
  
  console.log(`Found ${imageFiles.length} image(s) to optimize\n`);
  
  for (const file of imageFiles) {
    const inputPath = path.join(INPUT_DIR, file);
    await optimizeImage(inputPath, file);
  }
  
  console.log('\n✨ Optimization complete!\n');
  console.log(`Optimized images are in: ${OUTPUT_DIR}`);
}

processDirectory().catch(console.error);
