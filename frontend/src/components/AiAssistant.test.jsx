import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiAssistant from '../components/AiAssistant';

vi.mock('../lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../lib/authSession', () => ({
  decodeToken: vi.fn().mockReturnValue({ userId: 'test-user', clinicId: 'test-clinic', role: 'OWNER' }),
}));

const mockToken = 'test-token-123';

describe('AiAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders floating button when closed', () => {
    render(<AiAssistant token={mockToken} />);

    const button = screen.getByRole('button', { name: /ai/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('✨');
  });

  it('opens chat window when button clicked', () => {
    render(<AiAssistant token={mockToken} />);

    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    expect(screen.getByText('Σοφία AI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Γράψε την εντολή σου...')).toBeInTheDocument();
  });

  it('shows welcome message on open', () => {
    render(<AiAssistant token={mockToken} />);

    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    expect(screen.getByText('Γεια σου! Είμαι η Σοφία')).toBeInTheDocument();
  });

  it('sends command and displays response', async () => {
    const { default: api } = await import('../lib/api');
    api.post.mockResolvedValue({
      data: {
        success: true,
        action: 'send_sms',
        result: { patient: 'Γιάννης', phone: '+306912345678', message: 'Test message', status: 'SENT' },
      },
    });

    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    const input = screen.getByPlaceholderText('Γράψε την εντολή σου...');
    fireEvent.change(input, { target: { value: 'Στείλε SMS στον Γιάννη ότι το ραντεβού είναι αύριο' } });
    fireEvent.click(screen.getByRole('button', { name: /αποστολή/i }));

    await waitFor(() => {
      expect(screen.getByText('✅ SMS εστάλη στον/στην Γιάννης!')).toBeInTheDocument();
    });

    expect(api.post).toHaveBeenCalledWith('/ai/command', {
      command: 'Στείλε SMS στον Γιάννη ότι το ραντεβού είναι αύριο',
    });
  });

  it('shows error message on failed command', async () => {
    const { default: api } = await import('../lib/api');
    api.post.mockResolvedValue({
      data: { success: false, error: 'Δεν κατάλαβα την εντολή', suggestions: ['Δοκίμασε ξανά'] },
    });

    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    const input = screen.getByPlaceholderText('Γράψε την εντολή σου...');
    fireEvent.change(input, { target: { value: 'Invalid command' } });
    fireEvent.click(screen.getByRole('button', { name: /αποστολή/i }));

    await waitFor(() => {
      expect(screen.getByText('Δεν κατάλαβα την εντολή')).toBeInTheDocument();
    });
  });

  it('shows quick commands when chat is empty', () => {
    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    expect(screen.getByText('Σημερινά ραντεβού')).toBeInTheDocument();
    expect(screen.getByText('Αναπάντητες κλήσεις')).toBeInTheDocument();
  });

  it('fills input when quick command clicked', () => {
    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    fireEvent.click(screen.getByText('Σημερινά ραντεβού'));

    expect(screen.getByPlaceholderText('Γράψε την εντολή σου...')).toHaveValue('Δείξε μου τα σημερινά ραντεβού');
  });

  it('closes chat when X button clicked', () => {
    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    fireEvent.click(screen.getByRole('button', { name: /κλείσιμο/i }));

    expect(screen.queryByText('Σοφία AI')).not.toBeInTheDocument();
  });

  it('closes chat on Escape key', () => {
    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Σοφία AI')).not.toBeInTheDocument();
  });

  it('shows loading indicator while processing', async () => {
    const { default: api } = await import('../lib/api');
    let resolvePromise;
    api.post.mockImplementation(() => new Promise(r => { resolvePromise = r; }));

    render(<AiAssistant token={mockToken} />);
    fireEvent.click(screen.getByRole('button', { name: /ai/i }));

    const input = screen.getByPlaceholderText('Γράψε την εντολή σου...');
    fireEvent.change(input, { target: { value: 'Test command' } });
    fireEvent.click(screen.getByRole('button', { name: /αποστολή/i }));

    expect(screen.getByText('⋯')).toBeInTheDocument();

    resolvePromise({
      data: { success: true, action: 'list_today_appointments', result: { count: 0, appointments: [] } },
    });

    await waitFor(() => {
      expect(screen.queryByText('⋯')).not.toBeInTheDocument();
    });
  });
});