import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="back-link">
      <ArrowLeft size={18} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}
