import { redirect } from 'next/navigation';

// Root just forwards to the dashboard; middleware redirects unauthenticated
// users to /login.
export default function Home() {
  redirect('/dashboard');
}
