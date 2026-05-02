// src/__tests__/AuthContext.test.jsx
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';

// ── Mock firebase/auth ──────────────────────────────────────────────────────
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from 'firebase/auth';

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../firebase', () => ({
    auth: {},
    googleProvider: {},
}));

// ── Helper: consumer component that exposes context values ──────────────────
function TestConsumer() {
    const { currentUser, signup, login, loginWithGoogle, logout } = useAuth();
    return (
        <div>
            <span data-testid="user">{currentUser ? currentUser.email : 'null'}</span>
            <button onClick={() => login('a@b.com', 'pass123')}>login</button>
            <button onClick={() => signup('a@b.com', 'pass123')}>signup</button>
            <button onClick={() => loginWithGoogle()}>google</button>
            <button onClick={() => logout()}>logout</button>
        </div>
    );
}

function renderWithProvider() {
    return render(
        <AuthProvider>
            <TestConsumer />
        </AuthProvider>
    );
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('AuthContext', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders children once auth state resolves (loading=false)', async () => {
        // onAuthStateChanged fires callback immediately with null (logged out)
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return vi.fn(); });

        renderWithProvider();

        // children should be visible (loading is false)
        expect(screen.getByTestId('user')).toHaveTextContent('null');
    });

    it('does NOT render children while loading', () => {
        // onAuthStateChanged never fires → loading stays true
        onAuthStateChanged.mockImplementation(() => vi.fn());

        renderWithProvider();

        expect(screen.queryByTestId('user')).not.toBeInTheDocument();
    });

    it('sets currentUser when onAuthStateChanged provides a user', async () => {
        const fakeUser = { email: 'test@miraje.com' };
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(fakeUser); return vi.fn(); });

        renderWithProvider();

        expect(screen.getByTestId('user')).toHaveTextContent('test@miraje.com');
    });

    it('calls signInWithEmailAndPassword when login() is invoked', async () => {
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return vi.fn(); });
        signInWithEmailAndPassword.mockResolvedValue({ user: { email: 'a@b.com' } });

        renderWithProvider();
        await act(async () => {
            screen.getByText('login').click();
        });

        expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'a@b.com', 'pass123');
    });

    it('calls createUserWithEmailAndPassword when signup() is invoked', async () => {
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return vi.fn(); });
        createUserWithEmailAndPassword.mockResolvedValue({ user: { email: 'a@b.com' } });

        renderWithProvider();
        await act(async () => {
            screen.getByText('signup').click();
        });

        expect(createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'a@b.com', 'pass123');
    });

    it('calls signInWithPopup when loginWithGoogle() is invoked', async () => {
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return vi.fn(); });
        signInWithPopup.mockResolvedValue({ user: { email: 'g@google.com' } });

        renderWithProvider();
        await act(async () => {
            screen.getByText('google').click();
        });

        expect(signInWithPopup).toHaveBeenCalledWith({}, {});
    });

    it('calls signOut when logout() is invoked', async () => {
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return vi.fn(); });
        signOut.mockResolvedValue();

        renderWithProvider();
        await act(async () => {
            screen.getByText('logout').click();
        });

        expect(signOut).toHaveBeenCalledWith({});
    });

    it('calls the unsubscribe function on unmount', () => {
        const unsub = vi.fn();
        onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return unsub; });

        const { unmount } = renderWithProvider();
        unmount();

        expect(unsub).toHaveBeenCalledOnce();
    });
});