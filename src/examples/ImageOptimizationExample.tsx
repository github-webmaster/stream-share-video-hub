/**
 * Example: Using OptimizedImage Component
 * 
 * This demonstrates how to use modern image optimization
 * in your React components.
 */

import { OptimizedImage } from '../components/OptimizedImage';

export function ImageOptimizationExample() {
  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold">Image Optimization Examples</h1>
      
      {/* Example 1: Full-width hero image */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Full-Width Hero</h2>
        <OptimizedImage
          src="/assets/subtle-wallpaper-1.jpg"
          alt="Subtle background pattern"
          sizes="100vw"
          priority={true}
          className="w-full h-auto rounded-lg"
        />
        <p className="mt-2 text-sm text-gray-600">
          This image loads in AVIF format (19KB) instead of full JPEG (500KB+)
        </p>
      </section>

      {/* Example 2: Responsive grid image */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Responsive Grid</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OptimizedImage
            src="/assets/subtle-wallpaper-2.jpg"
            alt="Background pattern 2"
            sizes="(min-width: 768px) 50vw, 100vw"
            className="w-full h-auto rounded-lg"
          />
          <OptimizedImage
            src="/assets/subtle-wallpaper-1.jpg"
            alt="Background pattern 1"
            sizes="(min-width: 768px) 50vw, 100vw"
            className="w-full h-auto rounded-lg"
          />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Browser automatically serves appropriate size: small (640px) on mobile, 
          medium (1280px) on tablet, large (1920px) on desktop
        </p>
      </section>

      {/* Example 3: Fixed-size thumbnail */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Fixed-Size Thumbnails</h2>
        <div className="flex gap-4">
          <OptimizedImage
            src="/assets/subtle-wallpaper-1.jpg"
            alt="Thumbnail 1"
            sizes="150px"
            className="w-[150px] h-[150px] object-cover rounded-lg"
          />
          <OptimizedImage
            src="/assets/subtle-wallpaper-2.jpg"
            alt="Thumbnail 2"
            sizes="150px"
            className="w-[150px] h-[150px] object-cover rounded-lg"
          />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Uses smallest size variant (640px) for tiny thumbnails
        </p>
      </section>

      {/* Performance comparison */}
      <section className="bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Performance Benefits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong className="block text-lg mb-2">AVIF</strong>
            <p className="text-green-600">19-204KB</p>
            <p className="text-gray-600">Smallest, Chrome/Safari 16+</p>
          </div>
          <div>
            <strong className="block text-lg mb-2">WebP</strong>
            <p className="text-blue-600">34-251KB</p>
            <p className="text-gray-600">Small, widely supported</p>
          </div>
          <div>
            <strong className="block text-lg mb-2">JPEG (fallback)</strong>
            <p className="text-orange-600">142-410KB</p>
            <p className="text-gray-600">Universal support</p>
          </div>
        </div>
      </section>

      {/* Developer info */}
      <section className="border-l-4 border-blue-500 pl-4">
        <h3 className="font-semibold mb-2">For Developers:</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>✅ Images automatically serve AVIF → WebP → JPEG based on browser support</li>
          <li>✅ Multiple sizes generated for responsive loading (640px to 2560px)</li>
          <li>✅ Lazy loading by default (use priority={'{'}true{'}'} for above-fold)</li>
          <li>✅ Automatic fallback if optimized images don't exist</li>
          <li>✅ Run <code className="bg-gray-200 px-1 rounded">npm run optimize:images</code> to optimize new images</li>
        </ul>
      </section>
    </div>
  );
}
