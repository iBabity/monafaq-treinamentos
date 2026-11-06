/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  distDir: process.env.TRAINING_BUILD_DIR || '.next',
  experimental: { proxyClientMaxBodySize: '101mb' },
  allowedDevOrigins: ['192.168.101.243', 'localhost:3000']
};

export default nextConfig;
