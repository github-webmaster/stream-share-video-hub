# StreamShare Hub - Private Video Platform

Securely host and share your personal video collection with complete privacy control.

## Overview

StreamShare Hub is a private video hosting platform that gives you complete control over your video content. Upload, organize, and share videos with secure links while maintaining full privacy.

**Live Demo:** https://a7a05492-001e-426f-bdad-2a09175c8351.lovableproject.com/

## Features

### Core Features
- **Private Video Hosting** - Videos remain private until you explicitly share them
- **Secure Share Links** - Generate unique, secure links for each video
- **User Authentication** - Secure user accounts with role-based access
- **Drag & Drop Upload** - Simple file upload with progress tracking
- **Video Management** - Organize, edit titles, and delete videos
- **View Analytics** - Track video views and engagement
- **Mobile Responsive** - Works seamlessly on all devices
- **STORJ S3 Integration** - Decentralized cloud storage with automatic fallback (NEW!)

### Privacy & Security
- **Row-Level Security** - Database-level access controls
- **Encrypted Storage** - Videos stored with encryption at rest
- **Secure Authentication** - JWT-based user authentication
- **Privacy Controls** - Public/private video visibility settings
- **No Tracking** - No analytics or tracking on user behavior

### Performance
- **Optimized Database Queries** - Selective column loading for faster responses
- **Memoized Functions** - Reduced re-renders with useCallback optimization
- **Efficient Pagination** - Client-side pagination with configurable items per page
- **Lazy Loading** - Video thumbnails load on demand
- **CDN Integration Ready** - Prepared for global content delivery

## Technology Stack

### Frontend
- **React 18** - Modern UI framework with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Pre-built UI components
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Backend & Database
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Primary database with RLS policies
- **Supabase Auth** - User authentication and session management
- **Supabase Storage** - File storage with CDN capabilities
- **Supabase Edge Functions** - Serverless functions for upload handling
- **STORJ S3** - Decentralized cloud storage (optional)

### Development Tools
- **Vite** - Fast development server and build tool
- **ESLint** - Code linting and formatting
- **Vitest** - Unit testing framework

## Architecture

### Database Schema
```sql
-- Users and authentication
auth.users (Supabase auth)
public.profiles (user settings, roles, visibility)

-- Video content
public.videos (video metadata, storage paths, view counts)

-- Storage configuration (for multi-provider support)
public.storage_configs (S3, STORJ, local storage settings)
```

### Security Model
- **Row Level Security (RLS)** - Database-level access controls
- **JWT Authentication** - Secure session management
- **API Rate Limiting** - Prevent abuse and ensure fair usage
- **Input Validation** - Client and server-side validation

### Storage Architecture
- **Primary Storage** - Supabase Storage (current)
- **Fallback Storage** - Local file system
- **Future Providers** - S3, STORJ integration ready
- **CDN Support** - Global content delivery network

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/stream-share-hub.git
   cd stream-share-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   Create `.env.local` with:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database setup**
   Run migrations in Supabase SQL Editor:
   ```sql
   -- Apply all migrations from supabase/migrations/
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Deployment

#### Production Build
```bash
npm run build
```

#### Environment Variables for Production
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

#### Deployment Options
- **Vercel** - Zero-config deployment
- **Netlify** - Static site hosting
- **Docker** - Containerized deployment
- **VPS** - Traditional server deployment

## API Reference

### Authentication
```typescript
// Sign in
const { error } = await supabase.auth.signInWithPassword({
  email, password
});

// Sign up
const { error } = await supabase.auth.signUp({
  email, password, options: { emailRedirectTo }
});
```

### Video Operations
```typescript
// Fetch user videos
const { data } = await supabase
  .from("videos")
  .select("id, title, filename, storage_path, share_id, views, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

// Upload video
const { error } = await supabase.storage
  .from("videos")
  .upload(filePath, file);

// Insert video record
const { error } = await supabase.from("videos").insert({
  title, filename, storage_path: filePath, user_id
});
```

### Public Video Access
```typescript
// Get public video by share ID
const { data } = await supabase.rpc('get_public_video_by_share_id', {
  share_id_param: shareId
});
```

## Configuration

### User Roles
- **Admin** - Full system access, storage configuration
- **User** - Standard video upload and management
- **Anonymous** - Public video viewing only

### Storage Providers
- **Supabase Storage** - Default, integrated solution
- **Local Storage** - Fallback for development
- **S3 Compatible** - AWS S3, DigitalOcean Spaces
- **STORJ** - Decentralized storage (integration ready)

### Video Limits
- **File Size** - Configurable per user tier
- **File Types** - Video formats only (mp4, mov, avi, etc.)
- **Storage Quota** - Per-user storage limits
- **Rate Limits** - Upload and API request limits

## Performance Optimizations

### Database
- **Selective Queries** - Only fetch required columns
- **Indexing** - Optimized for user_id and created_at
- **Connection Pooling** - Supabase managed connections

### Frontend
- **Memoization** - useCallback for expensive functions
- **Lazy Loading** - Video thumbnails on scroll
- **Code Splitting** - Route-based code splitting
- **Image Optimization** - Responsive video thumbnails

### Network
- **CDN Ready** - Prepared for global CDN integration
- **Compression** - Gzip compression enabled
- **Caching** - Browser and CDN caching strategies

## Security Considerations

### Data Protection
- **Encryption at Rest** - Database and storage encryption
- **Encryption in Transit** - HTTPS/TLS for all communications
- **Input Sanitization** - XSS and injection prevention
- **Access Controls** - Role-based permissions

### Privacy Features
- **No Tracking** - No user analytics or tracking
- **Data Minimization** - Only collect necessary data
- **User Control** - Users control their data
- **Transparent Policies** - Clear privacy practices

## Development

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   ├── VideoCard.tsx   # Video display component
│   └── Navbar.tsx      # Navigation component
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── VideoPlayer.tsx # Video player page
│   └── Profile.tsx     # User profile
├── hooks/              # Custom React hooks
│   └── useAuth.tsx     # Authentication hook
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
└── lib/                # Utility functions
    └── utils.ts        # Helper functions
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run unit tests
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## STORJ S3 Integration (Optional)

StreamShare Hub supports decentralized cloud storage via STORJ S3 with automatic fallback to Supabase Storage.

### Features
- ✅ Decentralized cloud storage
- ✅ S3-compatible API
- ✅ Automatic fallback to Supabase
- ✅ Admin panel configuration
- ✅ Real-time progress tracking
- ✅ Error handling with retries

### Quick Setup

1. **Create STORJ account** at https://www.storj.io/
2. **Generate S3 credentials** (Access Key, Secret Key)
3. **Create a bucket** for your videos
4. **Configure in Admin Panel** (`/admin` route)
5. **Toggle STORJ ON** and enter credentials
6. **Test connection** and save

### Documentation
- **Setup Guide**: See `docs/STORJ_SETUP.md` for detailed instructions
- **Implementation Details**: See `docs/IMPLEMENTATION_SUMMARY.md`

### Default Behavior
- First registered user becomes admin automatically
- STORJ is optional - Supabase Storage works out of the box
- Fallback to Supabase if STORJ fails or not configured

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in `docs/` folder
- Review the FAQ section

---

Built with React, TypeScript, Supabase, and STORJ for secure private video hosting.
