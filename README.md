# Data-Entry-Portal

## Teacher class and section access

Teacher access to student and assessment data is limited to explicitly assigned class/section pairs. The new teacher-class-section migration creates the assignment table but intentionally does not assign existing sections to anyone.

Apply pending migrations with the normal deployment migration process (`RUN_MIGRATIONS=true`, the default), or run `npm run migration:run:dev` from `backend` when migrations are managed manually. Import the student roster, provision teacher accounts, then manage assignments from `backend`:

```text
npm run teacher -- assignments
npm run teacher -- assign "Full Name" 1 A
npm run teacher -- unassign "Full Name" 1 A
```

Each class/section can have only one teacher owner. An unassigned section is unavailable to all teachers until assigned. To transfer a section, unassign it from its current teacher before assigning it to the new teacher; existing student and assessment records remain intact.

## Excel exports

The **Students** and **Assessment records** pages provide an **Export Excel** action. It exports all records matching the current search, class, section, and status filters, including records in every page of the result. The backend applies the signed-in teacher's class/section assignments to both the list and the workbook; client-side filters do not grant access.
