/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mysql2', 'mongodb'],
  poweredByHeader: false,
};

export default nextConfig;