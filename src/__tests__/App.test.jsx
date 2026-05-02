// src/__tests__/App.test.jsx
// vi.mock calls are hoisted to the top of the file automatically by Vitest,
// so these mocks are in place before App.jsx (and its imports) are evaluated.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

vi.mock('../AuthContext', () => ({
    AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
    useAuth: vi.fn(() => ({ currentUser: null, logout: vi.fn() })),
}));

vi.mock('../Miraje', () => ({
    default: () => <div data-testid="miraje-app">Miraje</div>,
}));

vi.mock('../firebase', () => ({
    auth: {},
    googleProvider: {},
}));

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn((a, cb) => { cb(null); return vi.fn(); }),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: vi.fn(() => ({})),
}));

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
    });

    it('wraps the app in AuthProvider', () => {
        render(<App />);
        expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    });

    it('renders the Miraje component inside AuthProvider', () => {
        render(<App />);
        expect(screen.getByTestId('miraje-app')).toBeInTheDocument();
    });
});