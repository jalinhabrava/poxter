import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../app/page';

const drafts = [
  {
    id: 'draft-1',
    externalId: 'external-1',
    brandSlug: 'textifai',
    title: 'Bitcoin Monday',
    body: 'Start the week with a reminder.',
    status: 'draft',
    scheduledAt: null,
    scheduleMeta: { date: '2026-06-08', time_local: '09:00', timezone: 'Europe/Madrid' },
    sourceContext: null
  },
  {
    id: 'draft-2',
    externalId: 'external-2',
    brandSlug: 'textifai',
    title: 'Stack Stats',
    body: 'Small amounts. Consistent habit.',
    status: 'approved',
    scheduledAt: null,
    scheduleMeta: { date: '2026-06-09', time_local: '09:00', timezone: 'Europe/Madrid' },
    sourceContext: null
  }
];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.startsWith('/api/drafts?brandSlug=')) return jsonResponse({ ok: true, drafts });
    if (url === '/api/drafts/draft-1') return jsonResponse({ ok: true, draft: { ...drafts[0], title: 'Saved', body: 'Saved body' } });
    if (url === '/api/drafts/draft-1/approve') return jsonResponse({ ok: true, draft: { ...drafts[0], status: 'approved' } });
    if (url === '/api/drafts/draft-1/reject') return jsonResponse({ ok: true, draft: { ...drafts[0], status: 'rejected' } });
    if (url === '/api/drafts/draft-2/approve') return jsonResponse({ ok: true, draft: drafts[1] });
    if (url === '/api/drafts/draft-2/reject') return jsonResponse({ ok: true, draft: { ...drafts[1], status: 'rejected' } });
    if (url === '/api/drafts/draft-2/dry-run') {
      return jsonResponse({ ok: true, dryRun: true, bufferCalled: false, publishText: drafts[1].body, characterCount: drafts[1].body.length, limit: 280, draft: drafts[1] });
    }
    if (url === '/api/import/week-plan/validate') return jsonResponse({ ok: true });
    if (url === '/api/import/week-plan') return jsonResponse({ ok: true, imported: 2 });
    return jsonResponse({ ok: false, errors: ['unmocked'] }, 500);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('phase 4 dashboard UI', () => {
  it('renders three-zone review dashboard with all brands', async () => {
    render(<HomePage />);
    expect(await screen.findByText('Draft workspace')).toBeTruthy();
    expect(screen.getByText('Brands & Import')).toBeTruthy();
    expect(screen.getByText('Review & Publish Flow')).toBeTruthy();
    expect(screen.getAllByText('TextifAI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OnT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('David Bitcoinpendium').length).toBeGreaterThan(0);
  });

  it('selecting a draft updates editor content and counter', async () => {
    render(<HomePage />);
    await screen.findByText('Bitcoin Monday');
    fireEvent.click(screen.getByText('Stack Stats'));
    await waitFor(() => expect((screen.getByLabelText('Body') as HTMLTextAreaElement).value).toBe('Small amounts. Consistent habit.'));
    expect(screen.getByText('32 / 140')).toBeTruthy();
  });

  it('shows over-limit warning when body exceeds 140 chars', async () => {
    render(<HomePage />);
    const body = await screen.findByLabelText('Body');
    await waitFor(() => expect((body as HTMLTextAreaElement).value).toBe('Start the week with a reminder.'));
    fireEvent.change(body, { target: { value: 'x'.repeat(141) } });
    await waitFor(() => expect((body as HTMLTextAreaElement).value).toBe('x'.repeat(141)));
    expect(screen.getAllByText('141 / 140').length).toBeGreaterThan(0);
  });

  it('keeps dry-run disabled until all drafts reviewed', async () => {
    render(<HomePage />);
    await screen.findByText('Bitcoin Monday');
    expect((screen.getByRole('button', { name: 'Run dry-run' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('dry-run preview is body-only and never includes title', async () => {
    const allReviewed = drafts.map((draft) => ({ ...draft, status: 'approved' }));
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('/api/drafts?brandSlug=')) return jsonResponse({ ok: true, drafts: allReviewed });
      if (url.endsWith('/dry-run')) {
        const draft = allReviewed.find((item) => url.includes(item.id))!;
        return jsonResponse({ ok: true, dryRun: true, bufferCalled: false, publishText: draft.body, characterCount: draft.body.length, limit: 280, draft });
      }
      return jsonResponse({ ok: true, draft: allReviewed[0] });
    });

    render(<HomePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run dry-run' }));
    await screen.findByText('Dry-run OK');
    expect(screen.getByText(/bufferCalled: false/)).toBeTruthy();
    expect(screen.getByText(/"body": "Small amounts\. Consistent habit\./)).toBeTruthy();
    expect(screen.queryByText(/"title": "Stack Stats"/)).toBeNull();
  });

  it('schedule click never calls Buffer', async () => {
    const allReviewed = drafts.map((draft) => ({ ...draft, status: 'approved' }));
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('/api/drafts?brandSlug=')) return jsonResponse({ ok: true, drafts: allReviewed });
      if (url.endsWith('/dry-run')) return jsonResponse({ ok: true, dryRun: true, bufferCalled: false, publishText: 'Body only', characterCount: 9, limit: 280, draft: allReviewed[0] });
      return jsonResponse({ ok: true, draft: allReviewed[0] });
    });

    render(<HomePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run dry-run' }));
    await screen.findByText('Dry-run OK');
    fireEvent.click(screen.getByRole('button', { name: 'Schedule approved posts' }));
    expect(screen.getByText('Scheduling not wired in this slice. No Buffer call made.')).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => url.toString().toLowerCase().includes('buffer'))).toBe(false);
  });
});
