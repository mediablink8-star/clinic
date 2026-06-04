# ClinicFlow SaaS

> Modern clinic management system with AI-powered patient recovery, voice calls, and SMS automation.

[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)](https://github.com/mediablink8-star/clinic)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 🚀 Features

### Core Functionality
- **📅 Appointment Management** - Calendar view, booking, reminders
- **👥 Patient Management** - Complete patient records and history
- **📊 Analytics Dashboard** - Recovery tracking, revenue analytics
- **🔒 Multi-tenant SaaS** - Secure clinic isolation with role-based access

### AI & Automation
- **🤖 AI Assistant (Sophia)** - Natural language commands powered by Gemini
- **📞 Voice AI** - Automated patient calls via Vapi
- **💬 SMS Conversations** - Two-way SMS with intelligent booking
- **🔄 Recovery Automation** - Missed call recovery with follow-ups

### Integrations
- **📱 SMS** - Twilio integration with platform-level credentials
- **📧 Email** - SMTP for notifications and password reset
- **🔗 Webhooks** - n8n workflow automation
- **📆 Calendar** - Google Calendar sync (coming soon)

### Security & Compliance
- **🔐 Authentication** - JWT with MFA support
- **🛡️ Authorization** - Role-based access control (OWNER, ADMIN, RECEPTIONIST, ASSISTANT)
- **📝 Audit Logging** - Complete action history
- **🔒 Encryption** - Sensitive data encrypted at rest
- **⚖️ GDPR Compliant** - Privacy policy and data processing agreement

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 18 with Vite
- TanStack Query for data fetching
- Lucide React icons
- CSS custom properties for theming

**Backend**
- Node.js + Express
- PostgreSQL with Prisma ORM
- Redis + BullMQ for job queue
- JWT authentication

**AI & Automation**
- Google Gemini AI
- Vapi voice AI
- n8n workflow automation
- Twilio SMS

### Project Structure
```
clinic/
├── frontend/               # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── lib/           # API client, utilities
│   │   └── App.jsx        # Main app component
│   └── dist/              # Production build
│
├── backend/               # Node.js backend
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── middleware/       # Auth, validation, error handling
│   ├── prisma/           # Database schema & migrations
│   ├── index.js          # Main server
│   └── worker.js         # Background jobs
│
└── docs/                 # Documentation
    ├── PRODUCTION_CHECKLIST.md
    ├── DOUBLE_BOOKING_PREVENTION.md
    └── INTEGRATIONS.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (for production)
- n8n instance (for SMS workflows)

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/mediablink8-star/clinic.git
cd clinic
```

2. **Backend setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npx prisma migrate dev
npm run dev
```

3. **Frontend setup**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your API URL
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health check: http://localhost:4000/api/health

### Production Deployment

See [PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) for complete deployment guide.

**Quick deploy:**
```bash
# Backend (Render/Railway/Fly.io)
cd backend
npm install
npx prisma migrate deploy
npm start

# Frontend (Vercel/Netlify/Cloudflare Pages)
cd frontend
npm install
npm run build
# Deploy dist/ folder
```

## 📚 Documentation

- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Complete deployment guide
- [Double-Booking Prevention](docs/DOUBLE_BOOKING_PREVENTION.md) - Race condition handling
- [Integrations Guide](docs/INTEGRATIONS.md) - SMS, voice, webhooks setup
- [API Documentation](backend/routes/README.md) - API endpoints reference

## 🔑 Key Features Explained

### Double-Booking Prevention
Robust system preventing race conditions across all booking channels:
- Row-level locking with PostgreSQL `FOR UPDATE`
- Transaction isolation for atomicity
- Optimized indexes for fast conflict detection
- Works across: public booking, dashboard, voice calls, SMS

### Recovery System
Automated patient recovery workflow:
1. Missed call detected
2. SMS sent with booking link
3. Two-way conversation for booking
4. Follow-up reminders (24h, 48h)
5. Analytics and revenue tracking

### Voice AI Integration
Automated patient calls with Vapi:
- Natural conversation flow
- Appointment booking via voice
- SMS fallback if no answer
- Integration with recovery system

### Multi-Tenant Architecture
Secure clinic isolation:
- Clinic-scoped data access
- Per-clinic credentials (webhooks, API keys)
- Role-based permissions
- Audit logging per clinic

## 🔒 Security

- **Authentication**: JWT with secure secrets, MFA support
- **Authorization**: Role-based access control
- **Rate Limiting**: All endpoints protected
- **Input Validation**: Joi schemas for all inputs
- **SQL Injection**: Prevented by Prisma ORM
- **XSS**: React automatic escaping
- **CSRF**: SameSite cookies
- **Encryption**: Sensitive data encrypted at rest
- **Audit Logging**: All critical actions logged

## 📊 Monitoring

### Health Checks
```bash
curl https://your-backend.com/api/health
```

Response:
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok"
}
```

### System Status
Available in dashboard under Settings → System Status:
- Database connectivity
- Redis connectivity
- Worker status
- API usage
- Error rates

### Error Tracking
Sentry integration for both frontend and backend:
- Real-time error notifications
- Stack traces and context
- Performance monitoring
- Release tracking

## 🧪 Testing

### Manual Testing
```bash
# Run frontend tests
cd frontend
npm test

# Run backend tests
cd backend
npm test
```

### Load Testing
See [PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) for load testing scenarios.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Vapi](https://vapi.ai) - Voice AI platform
- [Twilio](https://twilio.com) - SMS provider
- [n8n](https://n8n.io) - Workflow automation
- [Google Gemini](https://ai.google.dev) - AI assistant
- [Prisma](https://prisma.io) - Database ORM
- [React](https://react.dev) - Frontend framework

## 📞 Support

- **Email**: support@clinicflow.app
- **Documentation**: [docs.clinicflow.app](https://docs.clinicflow.app)
- **Issues**: [GitHub Issues](https://github.com/mediablink8-star/clinic/issues)

## 🗺️ Roadmap

- [x] Google Calendar two-way sync
- [ ] WhatsApp integration
- [ ] Mobile app (React Native)
- [x] Advanced analytics dashboard
- [x] Multi-language support
- [ ] Payment processing integration
- [ ] Telemedicine video calls
- [ ] Electronic health records (EHR)

---

**Made with ❤️ for healthcare professionals**

**Version**: 1.0.0  
**Last Updated**: May 6, 2026  
**Status**: ✅ Production Ready

