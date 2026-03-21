# Seed accounts

Run after migrations:

```bash
npm run seed
```

Re-running removes any user whose email is listed below, then recreates them (idempotent for these emails only).

## Admin (single)

| Field    | Value                 |
| -------- | --------------------- |
| Email    | `admin@fitcheck.local` |
| Password | `Admin@12345`        |
| Role     | `ADMIN`              |

## Demo password (all non-admin seed users)

| Password | `FitCheck!demo` |
| -------- | --------------- |

## Users

| Email                     | Role             | Profile | Freelancer status   |
| ------------------------- | ---------------- | ------- | ------------------- |
| `ava@fitcheck.local`      | `USER`           | Full    | —                   |
| `morgan@fitcheck.local`   | `USER`           | Full    | —                   |
| `freelancer.approved@fitcheck.local` | `FREELANCE_USER` | Full | **approved** |
| `freelancer.pending@fitcheck.local`  | `FREELANCE_USER` | Full | **submitted** (pending) |
| `freelancer.draft@fitcheck.local`    | `FREELANCE_USER` | Full | **draft**     |
| `freelancer.rejected@fitcheck.local` | `FREELANCE_USER` | Full | **rejected** (with admin notes) |

Profiles include gender, skin tone, preferred fit, style tags, colors, and `measurementsJson` with a full versioned set (wizard + fit-engine friendly keys).

**Note:** Fit check flows that require vault photos still need you to upload front/back images in the app; seed does not create `UserMedia` rows.
