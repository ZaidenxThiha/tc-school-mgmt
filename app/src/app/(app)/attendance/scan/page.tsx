import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import FaceAttendanceScanner from '@/components/face-attendance-scanner';
import { getFaceConfig } from '@/lib/settings';

const OPERATE = ['owner', 'admin', 'accounts'];

export default async function FaceAttendancePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (!OPERATE.includes(role)) {
    return (
      <div className="page-narrow">
        <PageHeader title="Face Attendance" />
        <div className="card text-sm text-rose-700">You do not have permission to operate the attendance camera.</div>
      </div>
    );
  }

  const cfg = await getFaceConfig();

  return (
    <div className="page">
      <PageHeader
        title="Face Attendance"
        subtitle="Point the camera at the room. Recognized students and employees are recorded automatically — no class selection needed."
      />
      <AttendanceTabs />
      <FaceAttendanceScanner cooldownSeconds={cfg.cooldownSeconds} />
    </div>
  );
}
