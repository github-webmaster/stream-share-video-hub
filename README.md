# StreamShare Hub

Securely host and share your personal video collection.

## Features
- **Private Video Hosting**: Keep your videos secure and accessible only by you.
- **Easy Sharing**: Generate secure share links for friends and family.
- **Privacy Controls**: Global and per-video visibility settings.
- **Seamless Navigation**: A clean, consistent interface for managing your media.

## Technologies
This project is built with:
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase

## Getting Started

### Local Development
1. Clone the repository.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Set up your environment variables for Supabase (get these from your Supabase dashboard):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Start the development server:
   ```sh
   npm run dev
   ```

### Deployment
Build the production bundle:
```sh
npm run build
```
The output will be in the `dist` directory, ready to be hosted on any static site hosting service (Vercel, Netlify, etc.).
