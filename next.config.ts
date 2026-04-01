import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://*.zegocloud.com https://*.zego.im",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebasestorage.app https://firebasestorage.googleapis.com https://api.dicebear.com https://*.zegocloud.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com https://*.firebasestorage.app https://firebasestorage.googleapis.com wss://*.firebaseio.com https://*.zegocloud.com wss://*.zegocloud.com https://*.zego.im wss://*.zego.im https://*.coolzcloud.com wss://*.coolzcloud.com https://*.coolfcloud.com wss://*.coolfcloud.com https://*.coolbcloud.com wss://*.coolbcloud.com https://*.cooldcloud.com wss://*.cooldcloud.com https://*.coolgcloud.com wss://*.coolgcloud.com https://*.imzego.com wss://*.imzego.com https://generativelanguage.googleapis.com https://api.dicebear.com",
      "media-src 'self' blob: https://*.zegocloud.com https://*.zego.im",
      "frame-src 'self' https://*.firebaseapp.com https://*.zegocloud.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
