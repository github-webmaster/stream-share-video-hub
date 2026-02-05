import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 4000,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // Optimize images during build for production
    mode === 'production' && ViteImageOptimizer({
      // Image type specific optimizations
      png: {
        quality: 90,
        compressionLevel: 9,
      },
      jpeg: {
        quality: 85,
        progressive: true,
        mozjpeg: true,
      },
      jpg: {
        quality: 85,
        progressive: true,
        mozjpeg: true,
      },
      webp: {
        quality: 85,
        lossless: false,
      },
      avif: {
        quality: 75,
        lossless: false,
      },
      // Cache optimized images
      cache: true,
      cacheLocation: '.cache/vite-plugin-image-optimizer',
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Increase chunk size warning limit (images can be large)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Separate assets by type for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
}));
