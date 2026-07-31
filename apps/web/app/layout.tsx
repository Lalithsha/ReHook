import './globals.css';
import React from 'react';
import { Metadata } from 'next';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'ReHook Platform | Zero-Loss Webhook Delivery Engine',
  description: 'Enterprise Webhook Delivery Engine Operator Console & Telemetry Monitor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#080C14] text-slate-100 min-h-screen selection:bg-sky-500 selection:text-white">
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#090D16',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f3f4f6',
              borderRadius: '14px',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
