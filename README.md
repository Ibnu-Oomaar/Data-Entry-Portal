# Data-Entry-Portal

## Teacher class and section access

Teacher access to student and assessment data is limited to explicitly assigned class/section pairs. The new teacher-class-section migration creates the assignment table but intentionally does not assign existing sections to anyone.

Teacher accounts are provisioned by an administrator; public teacher registration is disabled. New accounts start with no class access; an administrator must assign one or more class/section pairs before students are available. New passwords are stored as Argon2id hashes. Existing scrypt hashes are upgraded to Argon2id after the teacher signs in successfully. Administrator-provisioned teachers need a password set once before password-based sign-in:

```powershell
$env:TEACHER_PASSWORD = "use-a-long-password"
npm run teacher -- set-password "Full Name"
Remove-Item Env:TEACHER_PASSWORD
```

The teacher sign-in page shows Khalid Harun and asks only for his account password. The login request is tied to his registered account; public teacher registration is disabled.

Apply pending migrations with the normal deployment migration process (`RUN_MIGRATIONS=true`, the default), or run `npm run migration:run:dev` from `backend` when migrations are managed manually. Import the student roster, provision teacher accounts, then manage assignments from `backend`:

```text
npm run teacher -- assignments
npm run teacher -- assign "Full Name" 1 A
npm run teacher -- unassign "Full Name" 1 A
```

Each teacher/section pair is assigned independently, so a section may be shared by multiple teachers. An unassigned section is unavailable to all teachers until assigned. Student access follows each teacher's assignments. Assessment records are private to their current owner, while creator/updater attribution is retained separately for audit history.

The Khalid Harun teacher-offboarding migration preserves his existing assignments, removes other teachers' assignments, and transfers non-conflicting assessment ownership. If an assessment conflicts with an existing Khalid-owned assessment for the same student, the original record is preserved in `assessment_teacher_ownership_archive` rather than overwritten or merged. Creator/updater IDs and name snapshots retain historical attribution; the `assessment_teacher_ownership_transfers` table records ownership changes. This migration is irreversible, so take a verified database backup before applying it.

## Excel exports

The **Students** and **Assessment records** pages provide an **Export Excel** action. It exports all records matching the current search, class, section, and status filters, including records in every page of the result. The backend applies the signed-in teacher's class/section assignments to both the list and the workbook; client-side filters do not grant access.

Assessment records are private to the teacher who entered them. The database preserves existing records under their original creator and allows separate teacher-owned assessments for a student if class/section ownership is later transferred. Assessment exports require one selected class and section and are limited to that teacher's records within that exact pair.
