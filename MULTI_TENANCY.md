# 🏥 Multi-Clinic Deployment Guide

This guide explains how to deploy the **ClinicFlow** automation system for multiple different clients (clinics).

Since the system currently loads configuration from `clinic.json`, the standard approach is to deploy **separate instances** for each clinic. This ensures data isolation (GDPR compliance) and independent customization.

---

## 🚀 Strategy: Dedicated Instances (Recommended)

Run a separate copy of the backend for each clinic. This is the safest way to guarantee that Clinic A never sees Clinic B's patients.

### Step 1: Clone & Configure
For each new client, create a fresh copy of the application.

1.  **Copy the Project**:
    ```bash
    cp -r clinic-automation/ clinic-client-alpha/
    ```

2.  **Personalize**:
    - Open `backend/config/clinic.json` in the new folder.
    - Update the `name`, `phone`, `services`, and `policies` for the new client.

3.  **Environment Setup**:
    - Create a `.env` file in the new folder.
    - **Important**: Give each clinic its own database file!
    ```env
    DATABASE_URL="file:./client_alpha.db"
    PORT=4001  # Use a different port if running on the same server
    GEMINI_API_KEY="sk-..."
    ```

### Step 2: Vapi Voice Setup
You will need a unique "Brain" (Assistant) for each clinic in Vapi.

1.  **Create Assistant**: In Vapi dashboard, create "Dr. Smith Receptionist".
2.  **Server URL**: Point to the specific instance URL for this client.
    - Client A: `https://api.client-a.com/api/vapi/webhook`
    - Client B: `https://api.client-b.com/api/vapi/webhook`
3.  **Dynamic Config**: Because each instance has its own `clinic.json`, the Vapi connector will automatically load the correct system prompt (Clinic Name, Hours, etc.) for that specific phone number.

---

## ☁️ Strategy: Docker (Advanced)

If you want to host hundreds of clinics, use Docker containers. You can use the same code image and inject the configuration.

1.  **Mount Config Volume**:
    Instead of editing code, mount the `clinic.json` as a volume when starting the container.
    ```bash
    docker run -d \
      -p 4001:4000 \
      -v /configs/clinic_a.json:/app/backend/config/clinic.json \
      -v /data/clinic_a.db:/app/backend/dev.db \
      my-clinic-image
    ```

---

## 🤖 Unified "Super-Brain" (Future Architecture)

If you want **ONE** backend to serve **ALL** clinics (True SaaS), you would need to modify the code:

1.  **Database**: Add `clinicId` to every table in `schema.prisma`.
2.  **API**: Require `x-clinic-id` header in every request.
3.  **Vapi**: Add a query parameter to the webhook URL:
    - URL: `https://api.saas.com/api/vapi/webhook?clinicId=123`
    - Code: Read `req.query.clinicId` and load the specific configuration from a database instead of a JSON file.
