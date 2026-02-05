import { useState, ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
}

/**
 * OptimizedImage Component
 * 
 * Automatically serves modern image formats (AVIF, WebP) with fallbacks
 * Supports responsive images with multiple sizes
 * 
 * @example
 * <OptimizedImage 
 *   src="/assets/background.jpg"
 *   alt="Background"
 *   sizes="100vw"
 * />
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  sizes = '100vw',
  priority = false,
  className,
  ...props
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  
  // Extract filename without extension
  const getBasename = (path: string) => {
    const filename = path.split('/').pop() || '';
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  };
  
  // Get directory path
  const getDirectory = (path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  };
  
  const basename = getBasename(src);
  const directory = getDirectory(src);
  const optimizedDir = `${directory}/optimized`;
  
  // Generate srcset for different sizes
  const generateSrcSet = (format: 'avif' | 'webp' | 'jpg') => {
    const sizes = [
      { width: 640, suffix: '-small' },
      { width: 1280, suffix: '-medium' },
      { width: 1920, suffix: '-large' },
      { width: 2560, suffix: '-xlarge' }
    ];
    
    const ext = format === 'jpg' ? 'jpg' : format;
    
    return sizes
      .map(({ width, suffix }) => `${optimizedDir}/${basename}${suffix}.${ext} ${width}w`)
      .join(', ');
  };
  
  // Fallback to original image if optimized versions don't exist
  if (imageError) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        {...props}
      />
    );
  }
  
  return (
    <picture>
      {/* AVIF - Best compression, modern browsers */}
      <source
        type="image/avif"
        srcSet={generateSrcSet('avif')}
        sizes={sizes}
      />
      
      {/* WebP - Good compression, wide support */}
      <source
        type="image/webp"
        srcSet={generateSrcSet('webp')}
        sizes={sizes}
      />
      
      {/* JPEG fallback - Universal support */}
      <img
        src={`${optimizedDir}/${basename}.jpg`}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        onError={() => setImageError(true)}
        sizes={sizes}
        {...props}
      />
    </picture>
  );
}
