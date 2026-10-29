'use client';

import LoadingPage from '@/components/LoadingPage';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect in the browser, not on the server: X's crawler must get this page
// (and its preview tags) rather than follow a redirect to the home page.
export function RedirectHome() {
  const router = useRouter();
  useEffect(() => router.replace('/'), [router]);
  return <LoadingPage />;
}
