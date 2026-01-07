import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('__session')?.value;

  // Redirect to dashboard if authenticated, otherwise to signin
  if (authCookie) {
    redirect(`/${locale}/dashboard`);
  } else {
    redirect(`/${locale}/signin`);
  }
}
