if (process.env.VERCEL === '1' && process.env.NODE_ENV !== 'production') {
  // Ensure Vercel builds run with a production NODE_ENV; preview env files default to "development"
  process.env.NODE_ENV = 'production';
}

const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header

  // Enable standalone output for Docker
  output: 'standalone',

  // Performance: Optimize package imports for better tree-shaking
  // NOTE: Firebase packages are excluded due to ESM/barrel optimization conflicts
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      'date-fns',
    ],
  },

  // Transpile Firebase packages for proper ESM handling
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/app', '@firebase/storage', '@firebase/util', '@firebase/component'],

  async rewrites() {
    return {
      // Use afterFiles to allow Next.js API routes to be handled first
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/:path*`,
        },
      ],
    };
  },

  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Allow the configured API origin in the CSP connect-src directive
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    let apiOrigin = 'http://localhost:3000';
    try {
      apiOrigin = new URL(configuredApiUrl).origin;
    } catch {
      // fall back to localhost when URL parsing fails
      apiOrigin = 'http://localhost:3000';
    }

    // Build CSP directives
    const connectSources = [
      "'self'",
      'https://firebaseauth.googleapis.com',
      'https://firebasestorage.googleapis.com',
      'https://firestore.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://*.cloudfunctions.net',
      'https://api.gendei.com',
    ];

    if (!connectSources.includes(apiOrigin)) {
      connectSources.push(apiOrigin);
    }

    if (!isProduction) {
      connectSources.push('http://localhost:*', 'ws://localhost:*');
    }

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://apis.google.com https://accounts.google.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "worker-src 'self' blob:",
      "connect-src 'self' https://firebaseauth.googleapis.com https://firebasestorage.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.cloudfunctions.net https://api.gendei.com https://graph.facebook.com https://*.facebook.com https://*.facebook.net http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
      "frame-src 'self' https://www.facebook.com https://*.facebook.com https://accounts.google.com https://*.firebaseapp.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];

    // Only add upgrade-insecure-requests in production (causes TLS errors in dev)
    if (isProduction) {
      cspDirectives.push("upgrade-insecure-requests");
    }

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Performance: CDN cache headers for static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000', // 30 days
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'pps.whatsapp.net',
      },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
