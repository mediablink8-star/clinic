import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';

const mockClinic = {
  id: 'clinic-1',
  name: 'Test Clinic',
  timezone: 'Europe/Athens',
  isActive: true,
  onboardingCompleted: true,
  role: 'OWNER',
};

const mockAppointments = [
  {
    id: 'apt-1',
    patientId: 'patient-1',
    patient: { name: 'John Doe', phone: '+306912345678' },
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    reason: 'Checkup',
    status: 'CONFIRMED',
    priority: 'NORMAL',
  },
];

const mockPatients = [
  { id: 'patient-1', name: 'John Doe', phone: '+306912345678' },
];

const mockRecoveryStats = { recovered: 5, pending: 3, revenue: 400, potentialRevenue: 240 };
const mockRecoveryLog = [];
const mockActivityFeed = [];
const mockRecoveryInsights = { staleNoReply: [], patientEngaged: [], failedSms: [], summary: {} };
const mockSystemStatus = { db: 'ok', redis: 'ok' };
const mockSystemStats = { missedCallsToday: 2, totalMissedCalls: 10, recoveredThisMonth: 3, recoveryRate: 30 };
const mockApiUsage = { sms: 10, ai: 5 };
const mockSpending = { totalCreditsUsed: 100, monthCreditsUsed: 50, totalMessagesSent: 20 };
const mockDoctorAnalytics = [];
const mockWarnings = [];

const mockProps = {
  clinic: mockClinic,
  appointments: mockAppointments,
  todayAppointments: mockAppointments,
  upcomingAppointments: mockAppointments,
  urgentCount: 0,
  patientsCount: 1,
  patients: mockPatients,
  token: 'test-token',
  recoveryStats: mockRecoveryStats,
  recoveryLog: mockRecoveryLog,
  activityFeed: mockActivityFeed,
  recoveryInsights: mockRecoveryInsights,
  systemStatus: mockSystemStatus,
  systemStats: mockSystemStats,
  apiUsage: mockApiUsage,
  spending: mockSpending,
  loading: false,
  warnings: mockWarnings,
  doctorAnalytics: mockDoctorAnalytics,
  isMobile: false,
  setCurrentTab: vi.fn(),
  setShowModal: vi.fn(),
  onRefresh: vi.fn(),
  onNotificationAction: vi.fn(),
  onUpdate: vi.fn(),
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders greeting with clinic name', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByText(/καλημ.*ερα/i)).toBeInTheDocument();
    expect(screen.getByText('Test Clinic')).toBeInTheDocument();
  });

  it('shows active/paused toggle', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByRole('button', { name: /ενεργο|σε παύση/i })).toBeInTheDocument();
  });

  it('renders hero stats section', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByText('Revenue Monitor')).toBeInTheDocument();
    expect(screen.getByText('Ανακτημένες κλήσεις')).toBeInTheDocument();
    expect(screen.getByText('Ποσοστό Ανάκτησης')).toBeInTheDocument();
  });

  it('renders RecoveryFeed component', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByText('Recovery Timeline')).toBeInTheDocument();
  });

  it('renders ActionCenter component', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByText('Action Center')).toBeInTheDocument();
  });

  it('renders QuickActions component', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByText('AI Command Center')).toBeInTheDocument();
  });

  it('renders AiAssistant component', () => {
    render(<Dashboard {...mockProps} />);
    expect(screen.getByRole('button', { name: /ai/i })).toBeInTheDocument();
  });

  it('shows onboarding checklist when not completed', () => {
    render(<Dashboard {...mockProps} clinic={{ ...mockClinic, onboardingCompleted: false }} />);
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('shows config warnings when present', () => {
    render(<Dashboard {...mockProps} warnings={[{ message: 'Twilio not configured' }]} />);
    expect(screen.getByText('Χρειάζονται ρυθμίσεις για πλήρη λειτουργία')).toBeInTheDocument();
  });

  it('shows inactive warning when clinic is paused', () => {
    render(<Dashboard {...mockProps} clinic={{ ...mockClinic, isActive: false }} />);
    expect(screen.getByText('Η Κλινική είναι ΣΕ ΠΑΥΣΗ')).toBeInTheDocument();
  });
});