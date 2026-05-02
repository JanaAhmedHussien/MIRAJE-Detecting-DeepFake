// src/__tests__/Miraje.test.jsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Miraje from '../Miraje';
import { useAuth } from '../AuthContext';

// ── Mock AuthContext ─────────────────────────────────────────────────────────
vi.mock('../AuthContext', () => ({ useAuth: vi.fn() }));

// ── Mock AuthPage (shown when logged out) ────────────────────────────────────
vi.mock('../AuthPage', () => ({
    default: () => <div data-testid="auth-page">AuthPage</div>,
}));

// ── Mock fetch (API calls) ────────────────────────────────────────────────────
// requestAnimationFrame, cancelAnimationFrame, canvas, and URL.createObjectURL
// are all polyfilled globally in src/setupTests.js
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Helpers ───────────────────────────────────────────────────────────────────
const loggedInUser = { email: 'user@miraje.com' };
const mockLogout = vi.fn();

function setupLoggedIn() {
    useAuth.mockReturnValue({ currentUser: loggedInUser, logout: mockLogout });
}
function setupLoggedOut() {
    useAuth.mockReturnValue({ currentUser: null, logout: mockLogout });
}

// Create a fake File object
function makeFile(name = 'test.jpg', type = 'image/jpeg', size = 1024) {
    return new File(['x'.repeat(size)], name, { type });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Miraje', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    // ── Auth gate ────────────────────────────────────────────────────────────────
    it('renders AuthPage when user is not logged in', () => {
        setupLoggedOut();
        render(<Miraje />);
        expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    });

    it('renders the main app when user is logged in', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByText('MIRAJE')).toBeInTheDocument();
    });

    // ── Header ────────────────────────────────────────────────────────────────────
    it('displays logged-in user email in the header', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByText('user@miraje.com')).toBeInTheDocument();
    });

    it('calls logout() when Logout button is clicked', async () => {
        setupLoggedIn();
        render(<Miraje />);
        await userEvent.click(screen.getByText(/logout/i));
        expect(mockLogout).toHaveBeenCalledOnce();
    });

    // ── Navigation ────────────────────────────────────────────────────────────────
    it('renders all four nav buttons', () => {
        setupLoggedIn();
        render(<Miraje />);
        ['Analysis', 'Archive', 'Reports', 'System'].forEach(label => {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        });
    });

    it('activates nav button on click', async () => {
        setupLoggedIn();
        render(<Miraje />);
        const archiveBtn = screen.getByRole('button', { name: 'Archive' });
        await userEvent.click(archiveBtn);
        expect(archiveBtn).toHaveClass('active');
    });

    // ── Mode tiles ────────────────────────────────────────────────────────────────
    it('renders all four detection mode tiles', () => {
        setupLoggedIn();
        render(<Miraje />);
        ['Image', 'Video', 'Audio', 'Signature'].forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('activates Image mode tile by default', () => {
        setupLoggedIn();
        render(<Miraje />);
        // The active tile has class "mode-tile active"
        const tiles = document.querySelectorAll('.mode-tile');
        expect(tiles[0]).toHaveClass('active'); // Image is index 0
    });

    it('switches active mode when another tile is clicked', async () => {
        setupLoggedIn();
        render(<Miraje />);
        const tiles = document.querySelectorAll('.mode-tile');
        await userEvent.click(tiles[1]); // Video
        expect(tiles[1]).toHaveClass('active');
        expect(tiles[0]).not.toHaveClass('active');
    });

    // ── Drop zone / file input ─────────────────────────────────────────────────
    it('shows "Submit for analysis" placeholder before any file is loaded', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByText(/submit for analysis/i)).toBeInTheDocument();
    });

    it('shows file name after a file is dropped', async () => {
        setupLoggedIn();
        render(<Miraje />);
        const dropZone = document.querySelector('.drop-zone');
        const file = makeFile('photo.jpg', 'image/jpeg');

        await act(async () => {
            fireEvent.drop(dropZone, {
                dataTransfer: { files: [file] },
            });
        });

        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });

    // ── Run button state ──────────────────────────────────────────────────────
    it('disables run button when no file is loaded', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByRole('button', { name: /no file selected/i })).toBeDisabled();
    });

    it('enables run button after file is loaded', async () => {
        setupLoggedIn();
        render(<Miraje />);
        const dropZone = document.querySelector('.drop-zone');
        const file = makeFile('photo.jpg', 'image/jpeg');

        await act(async () => {
            fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
        });

        const runBtn = screen.getByRole('button', { name: /initiate analysis/i });
        expect(runBtn).not.toBeDisabled();
    });

    // ── Analysis run ──────────────────────────────────────────────────────────
    it('shows pipeline panel when analysis is triggered', async () => {
        setupLoggedIn();
        // Mock a successful image API response
        mockFetch.mockResolvedValue({
            json: async () => ({ fake_probability: 85, prediction: 'fake' }),
        });
        render(<Miraje />);

        const dropZone = document.querySelector('.drop-zone');
        await act(async () => {
            fireEvent.drop(dropZone, { dataTransfer: { files: [makeFile()] } });
        });

        await act(async () => {
            await userEvent.click(screen.getByRole('button', { name: /initiate analysis/i }));
        });

        // Pipeline panel appears
        await waitFor(() =>
            expect(screen.getByText('Pipeline')).toBeInTheDocument()
        );
    });

    it('shows verdict score after successful analysis', async () => {
        setupLoggedIn();
        mockFetch.mockResolvedValue({
            json: async () => ({ fake_probability: 85, prediction: 'fake' }),
        });
        render(<Miraje />);

        const dropZone = document.querySelector('.drop-zone');
        await act(async () => {
            fireEvent.drop(dropZone, { dataTransfer: { files: [makeFile()] } });
        });
        await act(async () => {
            await userEvent.click(screen.getByRole('button', { name: /initiate analysis/i }));
        });

        await waitFor(() =>
            expect(screen.getByText(/synthetic detected/i)).toBeInTheDocument(),
            { timeout: 10000 }
        );
    });

    it('adds entry to Recent Cases history after analysis', async () => {
        setupLoggedIn();
        mockFetch.mockResolvedValue({
            json: async () => ({ fake_probability: 85, prediction: 'fake' }),
        });
        render(<Miraje />);

        const dropZone = document.querySelector('.drop-zone');
        await act(async () => {
            fireEvent.drop(dropZone, { dataTransfer: { files: [makeFile('test.jpg')] } });
        });
        await act(async () => {
            await userEvent.click(screen.getByRole('button', { name: /initiate analysis/i }));
        });

        await waitFor(() =>
            expect(screen.getByText('test.jpg')).toBeInTheDocument(),
            { timeout: 10000 }
        );
    });

    // ── API failure handling ───────────────────────────────────────────────────
    it('does not crash and resets state when API call fails', async () => {
        setupLoggedIn();
        mockFetch.mockRejectedValue(new Error('Network error'));
        render(<Miraje />);

        const dropZone = document.querySelector('.drop-zone');
        await act(async () => {
            fireEvent.drop(dropZone, { dataTransfer: { files: [makeFile()] } });
        });

        // Click run — pipeline starts, then fetch rejects
        await act(async () => {
            await userEvent.click(screen.getByRole('button', { name: /initiate analysis/i }));
        });

        // Wait for either "Initiate Analysis" (reset) or "No File Selected"
        // Both mean the component is no longer stuck in "Analysing…"
        await waitFor(() => {
            const btn = screen.queryByRole('button', { name: /analysing/i });
            expect(btn).not.toBeInTheDocument();
        }, { timeout: 15000 });
    });

    // ── Verdict ring initial state ─────────────────────────────────────────────
    it('shows "Awaiting Input" as initial verdict word', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByText(/awaiting input/i)).toBeInTheDocument();
    });

    it('shows "Submit a file to begin" as initial verdict note', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByText(/submit a file to begin/i)).toBeInTheDocument();
    });

    // ── Mode change resets state ───────────────────────────────────────────────
    it('shows "No cases analysed yet" in the history table initially', () => {
        setupLoggedIn();
        render(<Miraje />);
        expect(screen.getByText(/no cases analysed yet/i)).toBeInTheDocument();
    });
});