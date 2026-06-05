import { sql } from '@/lib/db';
import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import FaceRegisterForm from '@/components/face-register-form';
import DeleteButton from '@/components/delete-button';
import SubmitButton from '@/components/submit-button';
import type { ComboOption } from '@/components/student-combobox';
import { listFaceProfiles } from '@/lib/face/profiles';
import { getFaceConfig } from '@/lib/settings';
import { deactivateFaceAction, updateFaceConfigAction } from '@/lib/actions/face';

export default async function RecordFacePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="page-narrow">
        <PageHeader title="Record Face" />
        <div className="card text-sm text-rose-700">Admin role required.</div>
      </div>
    );
  }

  const [studentRows, employeeRows, profiles, cfg] = await Promise.all([
    sql`select id, english_name, myanmar_name from students where current_status = 'Active' order by english_name limit 5000`,
    sql`select id, full_name, short_name from employees where is_active order by full_name limit 2000`,
    listFaceProfiles(),
    getFaceConfig(),
  ]);

  const students: ComboOption[] = (studentRows as unknown as { id: number; english_name: string | null; myanmar_name: string | null }[]).map(
    (s) => ({ id: s.id, label: `${s.english_name ?? s.myanmar_name ?? `#${s.id}`} (#${s.id})` }),
  );
  const employees: ComboOption[] = (employeeRows as unknown as { id: number; full_name: string | null; short_name: string | null }[]).map(
    (e) => ({ id: e.id, label: `${e.full_name ?? e.short_name ?? `#${e.id}`} (#${e.id})` }),
  );

  return (
    <div className="page">
      <PageHeader title="Record Face" subtitle="Register a student or employee face — only the embedding is stored, never the photo." />
      <AttendanceTabs />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="font-medium mb-3">Register / re-record</div>
          <FaceRegisterForm students={students} employees={employees} />
        </section>

        <section className="card p-0 overflow-hidden self-start">
          <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
            <span>Registered faces ({profiles.length})</span>
          </div>
          <div className="max-h-[24rem] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Updated</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const del = deactivateFaceAction.bind(null, p.id);
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="capitalize text-xs text-slate-500">{p.person_type}</td>
                      <td className="text-xs text-slate-500">{p.updated_at}</td>
                      <td className="text-right">
                        <DeleteButton action={del} label="Remove" description="Remove this face profile? The person can be re-recorded later." />
                      </td>
                    </tr>
                  );
                })}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-sm text-slate-400 py-6">
                      No faces registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-6 max-w-2xl">
        <div className="font-medium mb-3">Recognition settings</div>
        <form action={updateFaceConfigAction} className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-slate-500">Match threshold (0–1)</span>
            <input name="match_threshold" type="number" step="0.01" min="0" max="1" defaultValue={cfg.matchThreshold} className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-slate-500">Late after (minutes)</span>
            <input name="late_minutes" type="number" min="0" max="120" defaultValue={cfg.lateMinutes} className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-slate-500">Cooldown (seconds)</span>
            <input name="cooldown_seconds" type="number" min="0" max="3600" defaultValue={cfg.cooldownSeconds} className="input" />
          </label>
          <label className="space-y-1">
            <span className="text-slate-500">Min face size (px)</span>
            <input name="min_face_px" type="number" min="20" max="1000" defaultValue={cfg.minFacePx} className="input" />
          </label>
          <div className="col-span-2">
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
