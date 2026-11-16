# Data-Entry-Portal

## Teacher class and section access

Teacher access to student and assessment data is limited to explicitly assigned class/section pairs. The new teacher-class-section migration creates the assignment table but intentionally does not assign existing sections to anyone.

Teachers can create accounts from the teacher sign-in page using a password of at least 12 characters. New accounts start with no class access; an administrator must assign one or more class/section pairs before students are available. New passwords are stored as Argon2id hashes. Existing scrypt hashes are upgraded to Argon2id after the teacher signs in successfully. Administrator-provisioned teachers need a password set once before password-based sign-in:

```powershell
$env:TEACHER_PASSWORD = "use-a-long-password"
npm run teacher -- set-password "Full Name"
Remove-Item Env:TEACHER_PASSWORD
```

Apply pending migrations with the normal deployment migration process (`RUN_MIGRATIONS=true`, the default), or run `npm run migration:run:dev` from `backend` when migrations are managed manually. Import the student roster, provision teacher accounts, then manage assignments from `backend`:

```text
npm run teacher -- assignments
npm run teacher -- assign "Full Name" 1 A
npm run teacher -- unassign "Full Name" 1 A
```

Each class/section can have only one teacher owner. An unassigned section is unavailable to all teachers until assigned. To transfer a section, unassign it from its current teacher before assigning it to the new teacher; existing student and assessment records remain intact.

## Excel exports

The **Students** and **Assessment records** pages provide an **Export Excel** action. It exports all records matching the current search, class, section, and status filters, including records in every page of the result. The backend applies the signed-in teacher's class/section assignments to both the list and the workbook; client-side filters do not grant access.

Assessment records are private to the teacher who entered them. The database preserves existing records under their original creator and allows separate teacher-owned assessments for a student if class/section ownership is later transferred. Assessment exports require one selected class and section and are limited to that teacher's records within that exact pair.
