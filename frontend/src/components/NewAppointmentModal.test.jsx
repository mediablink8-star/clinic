import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewAppointmentModal from '../components/NewAppointmentModal';

const mockPatients = [
  { id: 'patient-1', name: 'John Doe', phone: '+306912345678' },
  { id: 'patient-2', name: 'Jane Smith', phone: '+306987654321' },
];

const mockDoctors = [
  { id: 'doc-1', name: 'Dr. Test', specialty: 'Cardiology' },
];

const mockProps = {
  isOpen: true,
  onClose: vi.fn(),
  patients: mockPatients,
  doctors: mockDoctors,
  onSubmit: vi.fn(),
  defaultDate: new Date().toISOString().split('T')[0],
};

describe('NewAppointmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<NewAppointmentModal {...mockProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Νέο Ραντεβού')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<NewAppointmentModal {...mockProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows patient dropdown', () => {
    render(<NewAppointmentModal {...mockProps} />);
    expect(screen.getByLabelText(/ασθενής/i)).toBeInTheDocument();
  });

  it('shows doctor dropdown', () => {
    render(<NewAppointmentModal {...mockProps} />);
    expect(screen.getByLabelText(/γιατρός/i)).toBeInTheDocument();
  });

  it('shows date and time inputs', () => {
    render(<NewAppointmentModal {...mockProps} />);
    expect(screen.getByLabelText(/ημερομηνία/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ώρα/i)).toBeInTheDocument();
  });

  it('shows reason textarea', () => {
    render(<NewAppointmentModal {...mockProps} />);
    expect(screen.getByLabelText(/αιτιολογία/i)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<NewAppointmentModal {...mockProps} />);
    fireEvent.click(screen.getByRole('button', { name: /κλείσιμο/i }));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking outside modal', () => {
    render(<NewAppointmentModal {...mockProps} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('calls onSubmit with form data when submitted', async () => {
    render(<NewAppointmentModal {...mockProps} />);
    
    await userEvent.selectOptions(screen.getByLabelText(/ασθενής/i), 'patient-1');
    await userEvent.selectOptions(screen.getByLabelText(/γιατρός/i), 'doc-1');
    await userEvent.type(screen.getByLabelText(/αιτιολογία/i), 'Regular checkup');
    
    fireEvent.click(screen.getByRole('button', { name: /αποθήκευση|καταχώρηση/i }));
    
    await waitFor(() => {
      expect(mockProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient-1',
          doctorId: 'doc-1',
          reason: 'Regular checkup',
        })
      );
    });
  });

  it('disables submit button when required fields empty', () => {
    render(<NewAppointmentModal {...mockProps} />);
    const submitBtn = screen.getByRole('button', { name: /αποθήκευση|καταχώρηση/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when required fields filled', async () => {
    render(<NewAppointmentModal {...mockProps} />);
    
    await userEvent.selectOptions(screen.getByLabelText(/ασθενής/i), 'patient-1');
    await userEvent.type(screen.getByLabelText(/αιτιολογία/i), 'Test reason');
    
    const submitBtn = screen.getByRole('button', { name: /αποθήκευση|καταχώρηση/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('shows loading state during submission', async () => {
    const slowSubmit = vi.fn(() => new Promise(r => setTimeout(r, 100)));
    render(<NewAppointmentModal {...mockProps} onSubmit={slowSubmit} />);
    
    await userEvent.selectOptions(screen.getByLabelText(/ασθενής/i), 'patient-1');
    await userEvent.type(screen.getByLabelText(/αιτιολογία/i), 'Test');
    
    fireEvent.click(screen.getByRole('button', { name: /αποθήκευση|καταχώρηση/i }));
    
    expect(screen.getByRole('button', { name: /αποθήκευση|καταχώρηση/i })).toBeDisabled();
    expect(screen.getByText(/αποθήκευση...|καταχώρηση.../i)).toBeInTheDocument();
  });
});