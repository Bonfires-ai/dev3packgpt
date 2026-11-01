/** @type {import('next').NextConfig} */
// Sites allowed to embed the app in an iframe (space-separated origins).
const embedOrigins = process.env.EMBED_ALLOWED_ORIGINS ?? 'https://app.dev3pack.xyz';

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${embedOrigins}` }],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/talk',
        destination: '/',
        permanent: false,
        missing: [
          {
            type: 'query',
            key: 'mood',
            value: 'english',
          },
          {
            type: 'query',
            key: 'mood',
            value: 'french',
          },
        ],
      },
    ];
  },

  webpack: config => {
    config.externals.push('pino-pretty');
    return config;
  },
};

export default nextConfig;
