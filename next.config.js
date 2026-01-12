/** @type {import('next').NextConfig} */

// Content-Security-Policy設定
// Rechartsはinline script/styleを使用するため、unsafe-inline/unsafe-evalが必要
// MUIもCSS-in-JSのためunsafe-inlineが必要
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://api.e-stat.go.jp;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
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
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  compiler: {
    emotion: true,
  },
  // サーバーサイド専用モジュールの外部化設定
  serverExternalPackages: ['pg', 'pg-native'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // クライアントサイドではpg関連モジュールを無視
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        pg: false,
        'pg-native': false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
