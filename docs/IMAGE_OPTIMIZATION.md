# Image Optimization Guide

This project includes automatic image optimization to improve performance and reduce bandwidth usage.

## Overview

Images are automatically optimized using modern formats (WebP and AVIF) with multiple sizes for responsive loading. This provides:

- **Up to 85% smaller file sizes** compared to JPEG/PNG
- **Faster page loads** with responsive images
- **Better user experience** on slow connections
- **Automatic fallbacks** for older browsers

## How It Works

### 1. Build-Time Optimization (Automatic)

During production builds, all images in your project are automatically optimized using the Vite Image Optimizer plugin. This happens transparently - no changes needed to your code.

**Configured in:** `vite.config.ts`

### 2. Manual Optimization (For Static Assets)

For existing images in the `public/assets` folder, run:

```bash
npm run optimize:images
```

This creates optimized versions in `/public/assets/optimized/` with multiple formats and sizes:

#### Generated Files

For each image (e.g., `background.jpg`), the script creates:

**Modern Formats:**
- `background-small.webp` (640px wide)
- `background-medium.webp` (1280px wide)
- `background-large.webp` (1920px wide)
- `background-xlarge.webp` (2560px wide)
- `background-small.avif` (640px wide)
- `background-medium.avif` (1280px wide)
- `background-large.avif` (1920px wide)
- `background-xlarge.avif` (2560px wide)

**Fallback:**
- `background.jpg` (optimized original format)

## Usage

### Using the OptimizedImage Component

```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

function MyComponent() {
  return (
    <OptimizedImage 
      src="/assets/background.jpg"
      alt="Background image"
      sizes="100vw"
      className="w-full h-auto"
    />
  );
}
```

The component automatically:
1. Serves AVIF to browsers that support it (smallest file size)
2. Falls back to WebP for browsers without AVIF support
3. Falls back to optimized JPEG for older browsers
4. Uses responsive images (srcset) to serve the right size

### Props

- `src` (string, required): Path to the original image
- `alt` (string, required): Alt text for accessibility
- `sizes` (string, optional): Responsive sizes hint (default: "100vw")
- `priority` (boolean, optional): Load eagerly instead of lazy loading
- `className` (string, optional): CSS classes
- All standard `<img>` attributes

### Sizes Attribute Examples

The `sizes` attribute tells the browser how large the image will be displayed:

```tsx
// Full width image
<OptimizedImage sizes="100vw" ... />

// Half width on desktop, full on mobile
<OptimizedImage sizes="(min-width: 768px) 50vw, 100vw" ... />

// Fixed maximum width
<OptimizedImage sizes="(min-width: 1280px) 1280px, 100vw" ... />

// Sidebar image
<OptimizedImage sizes="(min-width: 1024px) 300px, 100vw" ... />
```

## File Size Comparison

Based on our current background images:

### subtle-wallpaper-1.jpg (5000x3333)
- **Original:** ~500KB+ (estimated)
- **Optimized JPEG:** 142KB (-71%)
- **WebP (xlarge):** 34KB (-93%)
- **AVIF (xlarge):** 19KB (-96%)

### subtle-wallpaper-2.jpg (3000x2000)
- **Original:** ~800KB+ (estimated)
- **Optimized JPEG:** 410KB (-49%)
- **WebP (xlarge):** 251KB (-69%)
- **AVIF (xlarge):** 204KB (-74%)

## Adding New Images

### Static Images (public/assets)

1. Add your image to `public/assets/`
2. Run `npm run optimize:images`
3. Use `<OptimizedImage>` component in your code

### Images in Components

Just import and use - Vite will optimize automatically during build:

```tsx
import myImage from './my-image.jpg';

<OptimizedImage src={myImage} alt="My image" />
```

## Browser Support

- **AVIF:** Chrome 85+, Safari 16+, Firefox 93+
- **WebP:** Chrome 23+, Safari 14+, Firefox 65+
- **JPEG/PNG:** All browsers (fallback)

The component automatically serves the best format for each browser.

## Performance Tips

1. **Always specify sizes**: Helps browser download the right image size
2. **Use priority for above-fold images**: Prevents lazy loading delay
3. **Set explicit width/height**: Prevents layout shift
4. **Use appropriate quality settings**: Balance size vs. visual quality

## Configuration

### Optimization Settings

Edit `scripts/optimize-images.js` to adjust:

```javascript
const QUALITY = {
  webp: 85,  // 0-100
  avif: 75,  // 0-100
  jpeg: 85,  // 0-100
  png: 90    // 0-100
};

const SIZES = {
  small: 640,
  medium: 1280,
  large: 1920,
  xlarge: 2560
};
```

### Vite Plugin Settings

Edit `vite.config.ts` to adjust build-time optimization:

```typescript
ViteImageOptimizer({
  png: { quality: 90 },
  jpeg: { quality: 85 },
  webp: { quality: 85 },
  avif: { quality: 75 },
})
```

## Troubleshooting

### Images not loading?

1. Check browser console for 404 errors
2. Verify optimized images exist in `/public/assets/optimized/`
3. Run `npm run optimize:images` to regenerate

### Images look blurry?

Increase quality settings in `scripts/optimize-images.js` and re-run optimization.

### Build is slow?

AVIF compression is CPU-intensive. For faster builds, you can:
- Reduce `effort` parameter in optimization settings
- Pre-optimize images and commit them to the repo
- Use only WebP (remove AVIF from the component)

## Future Enhancements

Potential improvements for this system:

- [ ] CDN integration for automatic image optimization
- [ ] Automatic thumbnail generation for videos
- [ ] User avatar optimization on upload
- [ ] Blur-up placeholder technique
- [ ] Art direction with different crops per breakpoint
