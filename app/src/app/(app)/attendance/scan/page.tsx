import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import FaceAttendanceScanner from '@/components/face-attendance-scanner';
import { getFaceConfig } from '@/lib/settings';
import { ATTENDANCE_OPERATE } from '@/lib/auth-guard';

export default async function FaceAttendancePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (!(ATTENDANCE_OPERATE as readonly string[]).includes(role)) {
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
      {/* The locked 'attendance' role has no access to the sibling tabs. */}
      {role !== 'attendance' && <AttendanceTabs />}
      <FaceAttendanceScanner cooldownSeconds={cfg.cooldownSeconds} />
    </div>
  );
}
