import 'server-only';
import { headers } from 'next/headers';

export async function checkOrigin() {
  const origin = (await headers()).get('origin');
  if (!process.env.APP_ORIGIN || origin !== new URL(process.env.APP_ORIGIN).origin)
    throw new Error('Origem não autorizada.');
}
