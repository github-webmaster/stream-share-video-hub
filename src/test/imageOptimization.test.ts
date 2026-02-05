import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'fs';
import path from 'path';

describe('Image Optimization', () => {
  const optimizedDir = path.join(process.cwd(), 'public', 'assets', 'optimized');
  
  describe('Optimized images exist', () => {
    const images = ['subtle-wallpaper-1', 'subtle-wallpaper-2'];
    const sizes = ['small', 'medium', 'large', 'xlarge'];
    const formats = ['webp', 'avif', 'jpg'];
    
    images.forEach(imageName => {
      describe(imageName, () => {
        // Test responsive sizes
        sizes.forEach(size => {
          it(`should have ${size} WebP version`, () => {
            const imagePath = path.join(optimizedDir, `${imageName}-${size}.webp`);
            expect(existsSync(imagePath)).toBe(true);
          });
          
          it(`should have ${size} AVIF version`, () => {
            const imagePath = path.join(optimizedDir, `${imageName}-${size}.avif`);
            expect(existsSync(imagePath)).toBe(true);
          });
        });
        
        // Test fallback
        it('should have optimized JPEG fallback', () => {
          const imagePath = path.join(optimizedDir, `${imageName}.jpg`);
          expect(existsSync(imagePath)).toBe(true);
        });
      });
    });
  });
  
  describe('File size optimizations', () => {
    it('AVIF should be smaller than WebP for wallpaper-1', () => {
      const avifPath = path.join(optimizedDir, 'subtle-wallpaper-1-xlarge.avif');
      const webpPath = path.join(optimizedDir, 'subtle-wallpaper-1-xlarge.webp');
      
      if (existsSync(avifPath) && existsSync(webpPath)) {
        const avifSize = statSync(avifPath).size;
        const webpSize = statSync(webpPath).size;
        
        expect(avifSize).toBeLessThan(webpSize);
      }
    });
    
    it('WebP should be smaller than JPEG for wallpaper-1', () => {
      const webpPath = path.join(optimizedDir, 'subtle-wallpaper-1-xlarge.webp');
      const jpegPath = path.join(optimizedDir, 'subtle-wallpaper-1.jpg');
      
      if (existsSync(webpPath) && existsSync(jpegPath)) {
        const webpSize = statSync(webpPath).size;
        const jpegSize = statSync(jpegPath).size;
        
        expect(webpSize).toBeLessThan(jpegSize);
      }
    });
    
    it('small version should be smaller than xlarge version', () => {
      const smallPath = path.join(optimizedDir, 'subtle-wallpaper-2-small.avif');
      const xlargePath = path.join(optimizedDir, 'subtle-wallpaper-2-xlarge.avif');
      
      if (existsSync(smallPath) && existsSync(xlargePath)) {
        const smallSize = statSync(smallPath).size;
        const xlargeSize = statSync(xlargePath).size;
        
        expect(smallSize).toBeLessThan(xlargeSize);
      }
    });
  });
  
  describe('Image quality thresholds', () => {
    it('AVIF xlarge should be under 250KB', () => {
      const imagePath = path.join(optimizedDir, 'subtle-wallpaper-2-xlarge.avif');
      
      if (existsSync(imagePath)) {
        const size = statSync(imagePath).size;
        const sizeKB = size / 1024;
        
        expect(sizeKB).toBeLessThan(250);
      }
    });
    
    it('WebP small should be under 50KB', () => {
      const imagePath = path.join(optimizedDir, 'subtle-wallpaper-2-small.webp');
      
      if (existsSync(imagePath)) {
        const size = statSync(imagePath).size;
        const sizeKB = size / 1024;
        
        expect(sizeKB).toBeLessThan(50);
      }
    });
  });
});
