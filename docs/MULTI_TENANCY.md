# 🏥 Multi-Tenant SaaS Architecture

ClinicFlow is a multi-tenant SaaS application designed to serve multiple clinics from a single deployment. This ensures efficient resource usage, centralized updates, and secure data isolation.

---

## 🚀 Strategy: Multi-Tenant SaaS (Current)

The system is built from the ground up to handle multiple clinics within a single database and application instance.

### 1. Data Isolation
Every table in the database includes a `clinicId` field. Our middleware and services strictly enforce clinic scoping:
- **Authentication**: JWT tokens contain the `clinicId`.
- **Middleware**: The `requireAuth` middleware extracts `clinicId` and attaches it to the request object.
- **Database Queries**: All Prisma queries include `{ where: { clinicId } }` to ensure a clinic only accesses its own data.

### 2. Multi-Clinic Management
Platform admins can manage all clinics through the **Admin Control Plane**:
- Create new clinics and owner accounts.
- Monitor usage and credits across all tenants.
- Assign and upgrade plans (`trial`, `starter`, `growth`, `scale`, `enterprise`).
- Deactivate/Activate clinics.

### 3. Per-Clinic Configuration
Each clinic has its own:
- **Working Hours & Services**: Fully customizable.
- **AI Configuration**: Custom tone, SMS templates, and behavior.
- **Integrations**: Individual Vapi Assistant IDs, Zadarma credentials, and Webhook URLs.
- **Audit Logs**: Complete trail of actions performed within the clinic.

---

## ☁️ Deployment Strategy

### Standard SaaS
Deploy one instance of the backend and frontend. Users register their own clinics, and the system handles isolation automatically.
- **Backend**: Render, Fly.io, or AWS (Node.js + PostgreSQL).
- **Frontend**: Vercel or Netlify (React).
- **Database**: Supabase or Neon (PostgreSQL).

### Dedicated Instance (Optional)
While the system is multi-tenant, you *can* still deploy dedicated instances for high-value enterprise clients who require total database isolation for compliance (e.g., HIPAA).
1. Clone the repository.
2. Configure a dedicated database and environment variables.
3. Deploy as a standalone instance.

---

## 🤖 Future Roadmap
- **Custom Domains**: Allow clinics to use their own domains for public booking pages.
- **White-labeling**: Customizable branding (logos, colors) per clinic.
- **Advanced Permissions**: Granular RBAC within each clinic.
