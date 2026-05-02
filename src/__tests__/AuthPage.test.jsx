// src/__tests__/AuthPage.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthPage from '../AuthPage';
import { useAuth } from '../AuthContext';

// ── Mock AuthContext ─────────────────────────────────────────────────────────
vi.mock('../AuthContext', () => ({
    useAuth: vi.fn(),
}));

// ── Mock import.meta.env (Firebase config flag used in AuthPage) ─────────────
// Vitest exposes import.meta.env automatically; set it per test as needed.
// Default: configured (no setup notice)
const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockLoginGoogle = vi.fn();

function setupAuth(overrides = {}) {
    useAuth.mockReturnValue({
        login: mockLogin,
        signup: mockSignup,
        loginWithGoogle: mockLoginGoogle,
        ...overrides,
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('AuthPage', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        setupAuth();
    });

    // ── Rendering ──────────────────────────────────────────────────────────────
    it('renders the MIRAJE brand wordmark', () => {
        render(<AuthPage />);
        expect(screen.getByText('MIRAJE')).toBeInTheDocument();
    });

    it('renders Sign In tab as active by default', () => {
        render(<AuthPage />);
        const signInTab = screen.getByRole('button', { name: /sign in/i });
        expect(signInTab).toHaveClass('active');
    });

    it('renders email and password fields', () => {
        render(<AuthPage />);
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it('does NOT render confirm password field on login tab', () => {
        render(<AuthPage />);
        expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    });

    // ── Tab switching ──────────────────────────────────────────────────────────
    it('switches to Create Account tab and shows confirm password field', async () => {
        render(<AuthPage />);
        await userEvent.click(screen.getByRole('button', { name: /create account/i }));

        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('clears email and password when switching tabs', async () => {
        render(<AuthPage />);
        await userEvent.type(screen.getByLabelText(/email address/i), 'test@test.com');
        await userEvent.click(screen.getByRole('button', { name: /create account/i }));

        expect(screen.getByLabelText(/email address/i)).toHaveValue('');
    });

    // ── Login flow ─────────────────────────────────────────────────────────────
    it('calls login() with correct credentials on submit', async () => {
        mockLogin.mockResolvedValue({});
        render(<AuthPage />);

        await userEvent.type(screen.getByLabelText(/email address/i), 'user@miraje.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'secret123');
        document.getElementById('auth-submit-btn').click();

        expect(mockLogin).toHaveBeenCalledWith('user@miraje.com', 'secret123');
    });

    it('shows error message when login fails with wrong-password code', async () => {
        mockLogin.mockRejectedValue({ code: 'auth/wrong-password' });
        render(<AuthPage />);

        await userEvent.type(screen.getByLabelText(/email address/i), 'user@miraje.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpass');
        document.getElementById('auth-submit-btn').click();

        await waitFor(() =>
            expect(screen.getByText(/incorrect password/i)).toBeInTheDocument()
        );
    });

    it('shows error message for invalid-credential code', async () => {
        mockLogin.mockRejectedValue({ code: 'auth/invalid-credential' });
        render(<AuthPage />);

        await userEvent.type(screen.getByLabelText(/email address/i), 'x@x.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'pass');
        document.getElementById('auth-submit-btn').click();

        await waitFor(() =>
            expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
        );
    });

    // ── Signup flow ────────────────────────────────────────────────────────────
    it('calls signup() when on Create Account tab and passwords match', async () => {
        mockSignup.mockResolvedValue({});
        render(<AuthPage />);

        await userEvent.click(screen.getByRole('button', { name: /create account/i }));
        await userEvent.type(screen.getByLabelText(/email address/i), 'new@miraje.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'abc123');
        await userEvent.type(screen.getByLabelText(/confirm password/i), 'abc123');
        document.getElementById('auth-submit-btn').click();

        expect(mockSignup).toHaveBeenCalledWith('new@miraje.com', 'abc123');
    });

    it('shows "Passwords do not match" error without calling signup', async () => {
        render(<AuthPage />);

        await userEvent.click(screen.getByRole('button', { name: /create account/i }));
        await userEvent.type(screen.getByLabelText(/email address/i), 'new@miraje.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'abc123');
        await userEvent.type(screen.getByLabelText(/confirm password/i), 'different');
        document.getElementById('auth-submit-btn').click();

        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
        expect(mockSignup).not.toHaveBeenCalled();
    });

    it('shows error when email is already in use', async () => {
        mockSignup.mockRejectedValue({ code: 'auth/email-already-in-use' });
        render(<AuthPage />);

        await userEvent.click(screen.getByRole('button', { name: /create account/i }));
        await userEvent.type(screen.getByLabelText(/email address/i), 'exists@miraje.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'abc123');
        await userEvent.type(screen.getByLabelText(/confirm password/i), 'abc123');
        document.getElementById('auth-submit-btn').click();

        await waitFor(() =>
            expect(screen.getByText(/account with this email already exists/i)).toBeInTheDocument()
        );
    });

    // ── Google sign-in ─────────────────────────────────────────────────────────
    it('calls loginWithGoogle() when Google button is clicked', async () => {
        mockLoginGoogle.mockResolvedValue({});
        render(<AuthPage />);

        await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

        expect(mockLoginGoogle).toHaveBeenCalledOnce();
    });

    it('shows error when Google sign-in is cancelled', async () => {
        mockLoginGoogle.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
        render(<AuthPage />);

        await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

        await waitFor(() =>
            expect(screen.getByText(/google sign-in was cancelled/i)).toBeInTheDocument()
        );
    });

    // ── Loading state ──────────────────────────────────────────────────────────
    it('disables submit button while loading', async () => {
        mockLogin.mockReturnValue(new Promise(() => { })); // never resolves
        render(<AuthPage />);

        await userEvent.type(screen.getByLabelText(/email address/i), 'u@u.com');
        await userEvent.type(screen.getByLabelText(/^password$/i), 'pass');
        document.getElementById('auth-submit-btn').click();

        // loading=true → button is disabled
        expect(document.getElementById('auth-submit-btn')).toBeDisabled();
    });

    // ── Switch-tab link ────────────────────────────────────────────────────────
    it('renders "Create one" link on login tab', () => {
        render(<AuthPage />);
        expect(screen.getByRole('button', { name: /create one/i })).toBeInTheDocument();
    });

    it('renders "Sign in" link on signup tab', async () => {
        render(<AuthPage />);
        await userEvent.click(screen.getByRole('button', { name: /create account/i }));
        // Both the tab and the switch link say "Sign in/In" — find by class
        const switchBtn = document.querySelector('.auth-switch-btn');
        expect(switchBtn).toBeInTheDocument();
        expect(switchBtn).toHaveTextContent(/sign in/i);
    });
});