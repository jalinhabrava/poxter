'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { brands } from '../src/domain/brand-config';

type DraftStatus = 'draft' | 'needs_review' | 'approved' | 'rejected';

type Draft = {
  id: string;
  externalId: string;
  brandSlug: string;
  title: string;
  body: string;
  status: DraftStatus;
  scheduledAt: string | null;
  scheduleMeta: { date?: string; time_local?: string; timezone?: string; scheduledAt?: string | null } | null;
  sourceContext: unknown;
};

type ImportValidation = { ok: boolean; errors?: string[] };
type DryRunResult = { ok: boolean; dryRun: true; bufferCalled: false; characterCount: number; limit: number; errors?: string[]; payload: { brand: string; week: string | null; posts: Array<{ at: string | null; body: string }> } };
type ScheduledPost = { id: string; brandSlug: string; draftId: string | null; title: string; body: string; scheduledAt: string; externalStatus: string; payload: unknown; createdAt: string };
type BufferSettings = { ok: boolean; configured: boolean; connected?: boolean; mappings: Array<{ brandSlug: string; channelId: string; channelName: string | null }>; channels: Array<{ id: string; name: string | null }> };
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type WorkflowStep = { label: string; detail: string; done: boolean };

const MAX_BODY_LENGTH = 280;
const statuses: Array<{ value: 'all' | DraftStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_review', label: 'Needs review' }
];
const brandMeta = { textifai: { initials: 'T', short: 'TEXTIFAI' }, ont: { initials: 'O', short: 'ONT' }, bitcoinpendium: { initials: 'DB', short: 'BITCOINPENDIUM' } } as const;
const validationHints: Record<string, string> = {
  invalid_json: 'JSON inválido: revisa comas, comillas y llaves.',
  schema_version: 'Falta schema_version o no coincide con social-controller.week-plan.v1.',
  'brand.slug': 'brand.slug no coincide con una marca válida.',
  'brand.name': 'brand.name no coincide con el slug seleccionado.',
  'week.start_date': 'Falta week.start_date.',
  'week.end_date': 'Falta week.end_date.',
  'week.timezone': 'Falta week.timezone.',
  'draft.external_id': 'Algún draft no tiene external_id.',
  'draft.external_id.duplicate': 'Hay external_id repetidos entre drafts.',
  'draft.slot_id': 'Algún draft tiene un slot_id inválido.',
  'draft.platform': 'Algún draft no tiene platform.',
  'draft.format': 'Algún draft no tiene format.',
  'draft.title': 'Algún draft no tiene title.',
  'draft.body_or_thread_posts': 'Cada draft necesita body o thread_posts con contenido.',
  'draft.status': 'Algún draft tiene status no permitido.',
  'draft.external_status': 'Algún draft tiene external_status no permitido.'
};

function formatValidationErrors(errors?: string[]) {
  const uniqueErrors = Array.from(new Set(errors ?? []));
  if (uniqueErrors.length === 0) return 'Validation failed.';
  return uniqueErrors.slice(0, 6).map((error) => validationHints[error] ?? error).join(' ');
}
function formatScheduledLabel(draft: Draft) {
  if (!draft.scheduleMeta?.date) return 'No date';
  const date = new Date(`${draft.scheduleMeta.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return draft.scheduleMeta.date;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}
function cx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(' '); }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function monthLabel(date: Date) { return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
function dayKey(date: Date) { return date.toISOString().slice(0, 10); }
function scheduledPostDisplayTitle(post: ScheduledPost) {
  if ((post.title ?? '').trim()) return post.title;
  const scheduledAt = new Date(post.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) return 'Post unscheduled';
  return `Post ${scheduledAt.toISOString().slice(0, 10)} ${scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
function draftDisplayTitle(draft: Draft) {
  if ((draft.title ?? '').trim()) return draft.title;
  return `Post ${draft.scheduleMeta?.date ?? 'unscheduled'}${draft.scheduleMeta?.time_local ? ` ${draft.scheduleMeta.time_local}` : ''}`;
}
function formatApiError(payload: { errors?: string[]; retryAfterSeconds?: number }) {
  const error = payload.errors?.[0] ?? 'request_failed';
  if (error === 'buffer.rate_limited') {
    if (payload.retryAfterSeconds) {
      const retryAt = new Date(Date.now() + payload.retryAfterSeconds * 1000);
      return `Buffer 24h limit reached. Retry after ${retryAt.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}.`;
    }
    return 'Buffer 24h limit reached. Buffer did not send a retry time.';
  }
  if (error === 'buffer.api_key_missing') return 'Buffer API key missing. Add BUFFER_API_KEY to .env and restart server.';
  return (payload.errors ?? ['request_failed']).join(', ');
}
function messageTone(message: string) {
  const value = message.toLowerCase();
  if (value.includes('failed') || value.includes('error') || value.includes('missing') || value.includes('rate limit') || value.includes('limit reached')) return 'error' as const;
  if (value.includes('pending') || value.includes('locked') || value.includes('connect ') || value.includes('review ') || value.includes('add date') || value.includes('run dry-run')) return 'warn' as const;
  return 'ok' as const;
}

export default function HomePage() {
  const [selectedBrand, setSelectedBrand] = useState<(typeof brands)[number]['slug']>(brands[0].slug);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [editorDate, setEditorDate] = useState('');
  const [editorTime, setEditorTime] = useState('');
  const [editorTimezone, setEditorTimezone] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | DraftStatus>('all');
  const [importText, setImportText] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [importValidated, setImportValidated] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [apiHealthy, setApiHealthy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunMessage, setDryRunMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [centerView, setCenterView] = useState<'draft' | 'calendar'>('draft');
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [selectedCalendarPost, setSelectedCalendarPost] = useState<ScheduledPost | null>(null);
  const [bufferSettings, setBufferSettings] = useState<BufferSettings | null>(null);
  const [bufferSessionConnected, setBufferSessionConnected] = useState(false);

  const selectedBrandConfig = brands.find((brand) => brand.slug === selectedBrand) ?? brands[0];
  const visibleScheduledPosts = useMemo(() => scheduledPosts.filter((post) => post.brandSlug === selectedBrand), [scheduledPosts, selectedBrand]);
  const scheduledDraftIds = useMemo(() => new Set(visibleScheduledPosts.map((post) => post.draftId).filter(Boolean)), [visibleScheduledPosts]);
  const workspaceDrafts = useMemo(() => drafts.filter((draft) => !scheduledDraftIds.has(draft.id)), [drafts, scheduledDraftIds]);
  const filteredDrafts = useMemo(() => filterStatus === 'all' ? workspaceDrafts : workspaceDrafts.filter((draft) => draft.status === filterStatus), [workspaceDrafts, filterStatus]);
  const selectedDraft = useMemo(() => workspaceDrafts.find((draft) => draft.id === selectedDraftId) ?? filteredDrafts[0] ?? workspaceDrafts[0] ?? null, [workspaceDrafts, filteredDrafts, selectedDraftId]);
  const reviewedCount = useMemo(() => drafts.filter((draft) => draft.status === 'approved' || draft.status === 'rejected').length, [drafts]);
  const approvedCount = useMemo(() => drafts.filter((draft) => draft.status === 'approved').length, [drafts]);
  const rejectedCount = useMemo(() => drafts.filter((draft) => draft.status === 'rejected').length, [drafts]);
  const allReviewed = drafts.length > 0 && drafts.every((draft) => draft.status === 'approved' || draft.status === 'rejected');
  const allReviewedVisible = filteredDrafts.length > 0 && filteredDrafts.every((draft) => draft.status === 'approved' || draft.status === 'rejected');
  const bodyCount = editorBody.length;
  const bodyOverLimit = bodyCount > MAX_BODY_LENGTH;
  const canSave = Boolean(selectedDraft) && !saving;
  const canRunDryRun = allReviewedVisible && filteredDrafts.length > 0 && !runningDryRun;
  const selectedBufferMapping = bufferSettings?.mappings?.find((item) => item.brandSlug === selectedBrand) ?? null;
  const bufferConnected = Boolean(bufferSettings?.configured && selectedBufferMapping?.channelId && bufferSessionConnected);
  const approvedDrafts = useMemo(() => filteredDrafts.filter((draft) => draft.status === 'approved'), [filteredDrafts]);
  const approvedDraftsHaveSchedule = useMemo(() => approvedDrafts.length > 0 && approvedDrafts.every((draft) => Boolean(draft.scheduleMeta?.date && draft.scheduleMeta?.time_local && draft.scheduleMeta?.timezone)), [approvedDrafts]);
  const canSchedule = Boolean(dryRunResult?.ok) && allReviewedVisible && approvedDraftsHaveSchedule && bufferConnected;
  const calendarAnchor = useMemo(() => {
    if (visibleScheduledPosts[0]?.scheduledAt) return new Date(visibleScheduledPosts[0].scheduledAt);
    if (selectedDraft?.scheduleMeta?.date) return new Date(`${selectedDraft.scheduleMeta.date}T00:00:00`);
    return new Date();
  }, [visibleScheduledPosts, selectedDraft?.scheduleMeta?.date]);
  const currentMonth = startOfMonth(calendarAnchor);
  const currentMonthEnd = endOfMonth(calendarAnchor);
  const calendarPostsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const post of visibleScheduledPosts) {
      const key = dayKey(new Date(post.scheduledAt));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [visibleScheduledPosts]);
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarAnchor);
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    const start = new Date(monthStart);
    start.setDate(monthStart.getDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarAnchor]);
  const overLimitDraftIds = useMemo(() => new Set(drafts.filter((draft) => (draft.body ?? '').trim().length > MAX_BODY_LENGTH).map((draft) => draft.id)), [drafts]);
  const scheduleBlockReason = !bufferConnected ? 'Connect Buffer mapping for selected brand.' : !approvedDraftsHaveSchedule ? 'Add date and time to approved drafts.' : !allReviewedVisible ? 'Review all drafts first.' : !dryRunResult?.ok ? 'Run dry-run first.' : null;
  const workflowSteps: WorkflowStep[] = [
    { label: 'Import', detail: importMessage ?? 'Week plan imported', done: drafts.length > 0 },
    { label: 'Review drafts', detail: allReviewed ? 'All drafts reviewed' : 'Approve or reject all drafts', done: allReviewed },
    { label: 'Dry-run', detail: dryRunResult?.ok ? 'Validated locally' : 'Validate with local dry-run', done: Boolean(dryRunResult?.ok) },
    { label: 'Schedule', detail: canSchedule ? 'Ready to schedule' : !bufferConnected ? 'Connect Buffer mapping' : !approvedDraftsHaveSchedule ? 'Add date/time to approved drafts' : 'Schedule approved posts', done: false }
  ];

  useEffect(() => { void loadDrafts(selectedBrand, { resetSelection: true }); }, [selectedBrand]);
  useEffect(() => { void loadCalendar(); }, []);
  useEffect(() => { void loadBufferSettings(); }, [selectedBrand]);
  useEffect(() => { setBufferSessionConnected(Boolean(bufferSettings?.connected)); }, [bufferSettings?.connected]);
  useEffect(() => {
    const savedBrand = window.localStorage.getItem('poxter.selected-brand');
    if (savedBrand && brands.some((brand) => brand.slug === savedBrand)) setSelectedBrand(savedBrand as (typeof brands)[number]['slug']);
  }, []);
  useEffect(() => { window.localStorage.setItem('poxter.selected-brand', selectedBrand); }, [selectedBrand]);
  useEffect(() => {
    if (!selectedDraft) { setEditorTitle(''); setEditorBody(''); return; }
    setSelectedDraftId(selectedDraft.id);
    setEditorTitle(selectedDraft.title ?? '');
    setEditorBody(selectedDraft.body ?? '');
    setEditorDate(selectedDraft.scheduleMeta?.date ?? '');
    setEditorTime(selectedDraft.scheduleMeta?.time_local ?? '');
    setEditorTimezone(selectedDraft.scheduleMeta?.timezone ?? '');
  }, [selectedDraft?.id]);

  async function loadDrafts(brandSlug: string, options?: { resetSelection?: boolean }) {
    setLoadState('loading'); setActionMessage(null); setDryRunMessage(null);
    if (options?.resetSelection) setDryRunResult(null);
    try {
      const response = await fetch(`/api/drafts?brandSlug=${brandSlug}`);
      const payload = await response.json();
      if (!response.ok) throw new Error((payload.errors ?? ['load_failed']).join(', '));
      setApiHealthy(true); setDrafts(payload.drafts ?? []);
      setSelectedDraftId((current) => options?.resetSelection ? payload.drafts?.[0]?.id ?? null : current ?? payload.drafts?.[0]?.id ?? null);
      setLoadState('ready');
    } catch (error) {
      setApiHealthy(false); setLoadState('error'); setDrafts([]); setSelectedDraftId(null); setActionMessage(error instanceof Error ? error.message : 'Load failed');
    }
  }
  async function postJson<T>(url: string, body?: unknown, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { method: init?.method ?? 'POST', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }, body: body === undefined ? undefined : JSON.stringify(body), ...init });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(formatApiError(payload));
    return payload as T;
  }
  async function loadCalendar() {
    try { const response = await fetch('/api/calendar'); const payload = await response.json(); setScheduledPosts(response.ok ? payload.scheduledPosts ?? [] : []); } catch { setScheduledPosts([]); }
  }
  async function loadBufferSettings() {
    try { const response = await fetch('/api/settings/buffer'); const payload = await response.json(); if (!response.ok) throw new Error(); setBufferSettings(payload); } catch { setBufferSettings(null); }
  }
  async function handleConnectBuffer() {
    setActionMessage(null);
    try {
      const payload = await postJson<{ ok: boolean; connected?: boolean }>('/api/settings/buffer/connect');
      setBufferSessionConnected(Boolean(payload.connected));
      setBufferSettings((current) => current ? { ...current, connected: Boolean(payload.connected) } : current);
      setActionMessage('Buffer connected.');
    } catch (error) {
      setBufferSessionConnected(false);
      setActionMessage(error instanceof Error ? error.message : 'Buffer connect failed');
    }
  }
  async function handleValidateImport() {
    setValidationMessage(null);
    try { const json = JSON.parse(importText); const payload = await postJson<ImportValidation>('/api/import/week-plan/validate', { json }); setValidationMessage(payload.ok ? 'JSON valid for selected import contract.' : formatValidationErrors(payload.errors)); }
    catch (error) { setValidationMessage(error instanceof Error ? error.message : validationHints.invalid_json); setImportValidated(false); return; }
    setImportValidated(true);
  }
  async function handleImport() {
    setImportMessage(null); setDryRunResult(null);
    try { const json = JSON.parse(importText); const payload = await postJson<{ ok: boolean; imported: number }>('/api/import/week-plan', { json }); setImportMessage(`Imported ${payload.imported} drafts.`); await loadDrafts(selectedBrand, { resetSelection: true }); await loadCalendar(); }
    catch (error) { setImportMessage(error instanceof Error ? error.message : 'Import failed'); }
  }
  function getDefaultDraftSchedule() {
    const scheduled = new Date();
    scheduled.setHours(scheduled.getHours() + 1);
    const pad = (value: number) => String(value).padStart(2, '0');
    return {
      scheduleDate: `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())}`,
      scheduleTimeLocal: `${pad(scheduled.getHours())}:${pad(scheduled.getMinutes())}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    };
  }
  async function handleCreateDraft() {
    setActionMessage(null);
    try {
      const defaults = getDefaultDraftSchedule();
      const payload = await postJson<{ ok: boolean; draft: Draft }>('/api/drafts', { brandSlug: selectedBrand, title: '', body: '', ...defaults });
      setActionMessage('Draft created.');
      setSelectedDraftId(payload.draft.id);
      await loadDrafts(selectedBrand, { resetSelection: false });
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Create draft failed');
    }
  }
  async function handleUploadJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') { setImportMessage('Only .json files are accepted.'); return; }
    try { setImportText(await file.text()); setValidationMessage(null); setImportValidated(false); setImportMessage(`Loaded ${file.name}.`); } catch (error) { setImportMessage(error instanceof Error ? error.message : 'Could not read JSON file'); }
  }
  async function handleSave() {
    if (!selectedDraft) return; setSaving(true); setActionMessage(null);
    try { await postJson(`/api/drafts/${selectedDraft.id}`, { title: editorTitle, body: editorBody, scheduleDate: editorDate, scheduleTimeLocal: editorTime, timezone: editorTimezone }, { method: 'PATCH' }); setActionMessage('Draft saved.'); await loadDrafts(selectedBrand); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : 'Save failed'); } finally { setSaving(false); }
  }
  async function handleStatus(id: string, status: 'approve' | 'reject' | 'needs-review' | 'back-to-draft') {
    setActionMessage(null); setDryRunResult(null);
    try { await postJson(`/api/drafts/${id}/${status}`); setActionMessage(status === 'approve' ? 'Draft approved.' : status === 'reject' ? 'Draft rejected.' : 'Draft updated.'); await loadDrafts(selectedBrand); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : 'Status update failed'); }
  }
  async function handleBulkStatus(status: 'approve' | 'reject') {
    await postJson(status === 'approve' ? '/api/drafts/bulk-approve' : '/api/drafts/bulk-reject', { brandSlug: selectedBrand });
    setActionMessage(status === 'approve' ? 'All visible drafts approved.' : 'All visible drafts rejected.'); setDryRunResult(null); await loadDrafts(selectedBrand);
  }
  async function handleDryRun() {
    if (!canRunDryRun) return; setRunningDryRun(true); setDryRunMessage(null);
    try {
      const posts: DryRunResult['payload']['posts'] = [];
      for (const draft of filteredDrafts.filter((item) => item.status === 'approved')) {
        const payload = await postJson<{ ok: boolean; dryRun: true; bufferCalled: false; publishText: string; characterCount: number; limit: number; errors?: string[]; draft: Draft }>(`/api/drafts/${draft.id}/dry-run`);
        if (!payload.ok) throw new Error((payload.errors ?? ['dry_run_failed']).join(', '));
        posts.push({ at: draft.scheduleMeta?.scheduledAt ?? draft.scheduledAt ?? draft.scheduleMeta?.date ?? null, body: payload.publishText });
      }
      setDryRunResult({ ok: true, dryRun: true, bufferCalled: false, characterCount: Math.max(...posts.map((post) => post.body.length), 0), limit: MAX_BODY_LENGTH, payload: { brand: selectedBrandConfig.name, week: filteredDrafts[0]?.scheduleMeta?.date ?? null, posts } });
      setDryRunMessage('Dry-run completed locally. Buffer untouched.');
    } catch (error) { setDryRunResult(null); setDryRunMessage(error instanceof Error ? error.message : 'Dry-run failed'); } finally { setRunningDryRun(false); }
  }
  async function handleRefreshChannels(options?: { silent?: boolean }) {
    try { await postJson('/api/settings/buffer/refresh-channels'); await loadBufferSettings(); if (!options?.silent) setActionMessage('Buffer channels refreshed.'); }
    catch (error) { if (!options?.silent) setActionMessage(error instanceof Error ? error.message : 'Channel refresh failed'); }
  }
  async function handleSchedule() {
    if (!approvedDraftsHaveSchedule) { setActionMessage('Add date and time to every approved draft before scheduling.'); return; }
    if (!bufferConnected) { setActionMessage('Buffer must be connected for selected brand before scheduling.'); return; }
    if (!canSchedule) return;
    try { const payload = await postJson<{ ok: boolean; scheduled?: number }>('/api/scheduled-posts', { action: 'schedule-approved', brandSlug: selectedBrand }); setActionMessage(`Scheduled ${payload.scheduled ?? 0} posts.`); await loadCalendar(); await loadDrafts(selectedBrand); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : 'Schedule failed'); }
  }
  async function handleDeleteEverywhere() {
    if (!selectedDraft) return; const deletedDraftId = selectedDraft.id;
    try { const payload = await postJson<{ ok: boolean; errors?: string[] }>(`/api/drafts/${selectedDraft.id}/delete-everywhere`); if (payload.ok === false) throw new Error((payload.errors ?? ['Delete failed']).join(', ')); setDryRunResult(null); await loadDrafts(selectedBrand, { resetSelection: true }); await loadCalendar(); setActionMessage(`Deleted draft ${deletedDraftId}.`); }
    catch (error) { setActionMessage(error instanceof Error ? error.message : 'Delete failed'); }
  }

  return (
    <main className="min-h-screen bg-[#f3f0ea] text-[#211d18]">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col px-6 pb-6 pt-4 lg:px-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[#ddd4c8] bg-[#faf8f4] px-5 py-4 shadow-[0_12px_30px_rgba(60,40,20,0.08)]">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3a3837] text-lg font-semibold text-white">PX</div><p className="m-0 text-[15px] font-semibold tracking-[0.14em] text-[#6d6255]">PoXter</p></div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusPill label={`API: ${apiHealthy ? 'Operational' : 'Error'}`} tone={apiHealthy ? 'ok' : 'warn'} />
            <StatusPill label={`Buffer: ${bufferConnected ? 'Connected' : bufferSettings?.configured ? 'Configured' : 'Disconnected'}`} tone={bufferConnected ? 'ok' : bufferSettings?.configured ? 'warn' : 'muted'} />
            {workflowSteps.map((step, index) => <StatusPill key={step.label} label={`${index + 1}. ${step.label}: ${step.done ? 'OK' : 'Pending'}`} tone={step.done ? 'ok' : 'muted'} />)}
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <aside className="space-y-4">
            <Panel title="Brand switcher">
              <div className="space-y-3">
                <SectionLabel>Select brand</SectionLabel>
                {brands.map((brand) => {
                  const meta = brandMeta[brand.slug]; const active = brand.slug === selectedBrand;
                  return <button key={brand.slug} type="button" onClick={() => setSelectedBrand(brand.slug)} className={cx('flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition', active ? 'border-[#2d2b29] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.06)]' : 'border-[#ddd4c8] bg-[#fbfaf7] hover:bg-white')}><div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d7d0c5] bg-[#f0ede7] text-sm font-semibold text-[#4c443a]">{meta.initials}</div><div className="min-w-0"><div className="truncate text-base font-semibold">{brand.name}</div><div className="truncate text-xs tracking-[0.16em] text-[#7c7267]">{meta.short}</div></div></button>;
                })}
                <div className="rounded-2xl border border-[#ddd4c8] bg-[#fffdfa] px-4 py-3 text-sm text-[#4d443a]"><div className="font-semibold text-[#302920]">Buffer destination</div><div className="mt-1">{selectedBufferMapping ? `Mapped to ${selectedBufferMapping.channelName ?? selectedBufferMapping.channelId}` : 'No Buffer mapping yet.'}</div></div>
                <ActionButton onClick={() => void handleConnectBuffer()}>Connect Buffer</ActionButton>
                <ActionButton onClick={() => void handleRefreshChannels()}>Refresh channels</ActionButton>
              </div>
            </Panel>
            <Panel title="Import week plan JSON">
              <label className="mb-3 flex w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#cfc5b8] bg-[#fbfaf7] px-4 py-3 text-sm font-medium text-[#4d443a] transition hover:bg-white">Upload `.json`<input aria-label="Upload JSON file" type="file" accept=".json,application/json" className="hidden" onChange={handleUploadJson} /></label>
              <textarea aria-label="Week plan JSON" className="min-h-[190px] w-full rounded-2xl border border-dashed border-[#cfc5b8] bg-white px-4 py-4 text-sm leading-6 outline-none placeholder:text-[#9d9287]" placeholder="Paste JSON here" value={importText} onChange={(event) => { setImportText(event.target.value); setImportValidated(false); }} />
              <div className="mt-3 flex gap-3"><button type="button" onClick={handleValidateImport} className="flex-1 rounded-xl border border-[#cfc5b8] bg-white px-4 py-3 font-medium">Validate JSON</button><button type="button" disabled={!importValidated} onClick={handleImport} className={cx('flex-1 rounded-xl px-4 py-3 font-medium text-white transition', importValidated ? 'bg-[#5d8f68] shadow-[0_0_0_1px_rgba(52,96,66,0.15)] hover:bg-[#4f7e5a]' : 'bg-[#b7b1a8] opacity-60 cursor-not-allowed')}>{importValidated ? 'Import' : 'Validate first'}</button></div>
              <p className="mt-3 text-sm text-[#6d6255]">Imports week plan for selected brand.</p>{validationMessage ? <InlineMessage tone={validationMessage.toLowerCase().includes('valid') ? 'ok' : 'warn'}>{validationMessage}</InlineMessage> : null}{importMessage ? <InlineMessage tone={importMessage.toLowerCase().includes('imported') || importMessage.toLowerCase().includes('loaded') ? 'ok' : 'info'}>{importMessage}</InlineMessage> : null}
            </Panel>
          </aside>

          <section className="rounded-[30px] border border-[#ddd4c8] bg-[#faf8f4] p-4 shadow-[0_18px_40px_rgba(60,40,20,0.08)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4 px-2 pt-2">
              <div><div className="text-xs font-semibold uppercase tracking-[0.26em] text-[#7b7268]">{centerView === 'draft' ? 'Draft workspace' : 'Scheduled calendar'}</div><h1 className="m-0 mt-2 text-[2rem] font-semibold tracking-[-0.03em]">{centerView === 'draft' ? 'Week Drafts' : 'Calendar'}</h1></div>
              <div className="flex flex-wrap items-center gap-3"><StatusPill label={`${drafts.length} drafts / ${approvedCount} approved / ${rejectedCount} rejected`} tone="muted" /><select aria-label="Status filter" className="rounded-2xl border border-[#d9d0c4] bg-white px-4 py-3 text-sm" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as 'all' | DraftStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><div className="rounded-2xl border border-[#d9d0c4] bg-white px-4 py-3 text-sm font-medium">{monthLabel(calendarAnchor)}</div><div className="flex rounded-full border border-[#d9d0c4] bg-white p-1 text-sm"><button type="button" onClick={() => setCenterView('draft')} className={cx('rounded-full px-4 py-2 font-medium', centerView === 'draft' ? 'bg-[#f2efe8]' : 'text-[#6d6255]')}>Draft view</button><button type="button" onClick={() => setCenterView('calendar')} className={cx('rounded-full px-4 py-2 font-medium', centerView === 'calendar' ? 'bg-[#f2efe8]' : 'text-[#6d6255]')}>Calendar view</button></div></div>
            </div>

            {centerView === 'draft' ? (
              <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="relative space-y-3 rounded-[26px] border border-[#e1d8cc] bg-white p-3 pb-16">{loadState === 'loading' ? <p className="px-3 py-4 text-sm text-[#6d6255]">Loading drafts…</p> : null}{loadState !== 'loading' && filteredDrafts.length === 0 ? <p className="px-3 py-4 text-sm text-[#6d6255]">No drafts yet for this brand.</p> : null}{filteredDrafts.map((draft) => { const active = draft.id === selectedDraft?.id; const overLimit = overLimitDraftIds.has(draft.id); return <button key={draft.id} type="button" onClick={() => setSelectedDraftId(draft.id)} className={cx('w-full rounded-2xl border px-4 py-4 text-left transition', overLimit ? 'border-[#d8ae58] bg-[#fff8ea]' : active ? 'border-[#2d2b29] bg-[#fbfaf7] shadow-[0_10px_24px_rgba(0,0,0,0.06)]' : 'border-[#e7dfd4] bg-white hover:bg-[#f9f6f1]')}><div className="mb-2 flex items-start justify-between gap-3"><div className="text-sm text-[#5e5448]">{formatScheduledLabel(draft)}</div><div className="flex flex-wrap justify-end gap-2">{overLimit ? <span className="rounded-full bg-[#fff1ce] px-3 py-1 text-sm font-medium text-[#8d611d]">Body too long</span> : null}<StatusBadge status={draft.status} /></div></div><div className="mb-2 text-[1.05rem] font-semibold leading-6">{draftDisplayTitle(draft)}</div><div className="line-clamp-2 text-sm leading-6 text-[#4d443a]">{draft.body || 'No body yet.'}</div>{overLimit ? <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d611d]">{(draft.body ?? '').trim().length} / {MAX_BODY_LENGTH}</div> : null}</button>; })}<button type="button" title="New draft" aria-label="New draft" onClick={() => void handleCreateDraft()} className="group absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#2d2b29] bg-[#2d2b29] text-2xl font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.16)] transition hover:scale-105 hover:bg-[#1f1d1b]">+<span className="pointer-events-none absolute -top-10 right-0 rounded-full border border-[#ddd4c8] bg-white px-3 py-1 text-xs font-medium text-[#302920] opacity-0 shadow-[0_10px_20px_rgba(0,0,0,0.12)] transition group-hover:opacity-100">New draft</span></button></div>
                <div className="space-y-4 rounded-[26px] border border-[#e1d8cc] bg-white p-4"><div className="flex items-center gap-2"><button type="button" onClick={() => setActiveTab('editor')} className={cx('rounded-xl px-5 py-3 font-medium', activeTab === 'editor' ? 'bg-[#f2efe8] shadow-inner' : 'bg-transparent text-[#6d6255]')}>Editor</button><button type="button" onClick={() => setActiveTab('preview')} className={cx('rounded-xl px-5 py-3 font-medium', activeTab === 'preview' ? 'bg-[#f2efe8] shadow-inner' : 'bg-transparent text-[#6d6255]')}>Preview</button></div><label className="block text-sm font-semibold text-[#302920]">Internal Title <span className="font-normal text-[#7a7066]">(not published)</span><input aria-label="Internal Title" className="mt-2 w-full rounded-2xl border border-[#dcd3c7] bg-[#fffdfa] px-4 py-3 outline-none" value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} /></label><p className="text-sm text-[#857a6f]">Title is internal only. It is not published.</p><div className="grid gap-3 md:grid-cols-3"><label className="block text-sm font-semibold text-[#302920]">Date<input aria-label="Schedule date" type="date" className="mt-2 w-full rounded-2xl border border-[#dcd3c7] bg-[#fffdfa] px-4 py-3 outline-none" value={editorDate} onChange={(event) => setEditorDate(event.target.value)} /></label><label className="block text-sm font-semibold text-[#302920]">Time<input aria-label="Schedule time" type="time" className="mt-2 w-full rounded-2xl border border-[#dcd3c7] bg-[#fffdfa] px-4 py-3 outline-none" value={editorTime} onChange={(event) => setEditorTime(event.target.value)} /></label><label className="block text-sm font-semibold text-[#302920]">Timezone<input aria-label="Schedule timezone" className="mt-2 w-full rounded-2xl border border-[#dcd3c7] bg-[#fffdfa] px-4 py-3 outline-none" value={editorTimezone} onChange={(event) => setEditorTimezone(event.target.value)} /></label></div>{activeTab === 'editor' ? <label className="block text-sm font-semibold text-[#302920]">Body<textarea aria-label="Body" className="mt-2 min-h-[240px] w-full rounded-3xl border border-[#dcd3c7] bg-[#fffdfa] px-5 py-4 text-[1.05rem] leading-8 outline-none" value={editorBody} onChange={(event) => setEditorBody(event.target.value)} /><div className="mt-2 flex justify-end text-right text-sm font-medium text-[#5a5147]">{bodyCount} / {MAX_BODY_LENGTH}</div></label> : <div className="min-h-[240px] rounded-3xl border border-[#dcd3c7] bg-[#fffdfa] px-5 py-4 text-[1.05rem] leading-8 whitespace-pre-wrap">{editorBody || 'Preview empty.'}</div>}<div className="rounded-2xl border border-[#ddd4c8] bg-[#faf8f4] px-4 py-3 text-sm text-[#4d443a]">Only body is sent to X.</div>{bodyOverLimit ? <div className="rounded-3xl border border-dashed border-[#d0c2b1] bg-[#fbf7f2] px-5 py-4"><div className="text-base font-medium">Over-limit example (not active)</div><p className="mb-2 text-sm text-[#6d6255]">This body is {bodyCount} / {MAX_BODY_LENGTH} characters. Reduce to 140 or fewer.</p><div className="text-right text-sm font-medium text-[#5a5147]">{bodyCount} / {MAX_BODY_LENGTH}</div></div> : null}</div>
              </div>
            ) : (
              <div className="rounded-[26px] border border-[#e1d8cc] bg-white p-4"><div className="grid grid-cols-7 gap-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#7b7268]"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div><div className="mt-3 grid grid-cols-7 gap-3">{calendarDays.map((date) => { const key = dayKey(date); const posts = calendarPostsByDay.get(key) ?? []; const inMonth = date >= currentMonth && date <= currentMonthEnd; return <div key={key} className={cx('min-h-[148px] rounded-2xl border p-3 text-left', inMonth ? 'border-[#ddd4c8] bg-white' : 'border-[#eee6da] bg-[#faf8f4] text-[#b3a999]')}><div className="mb-2 text-sm font-semibold">{date.getDate()}</div><div className="space-y-2">{posts.map((post) => <button key={post.id} type="button" onClick={() => setSelectedCalendarPost(post)} className="w-full rounded-xl border border-[#dfe9dc] bg-[#f5fbf3] px-3 py-2 text-left hover:border-[#b8d4b0] hover:bg-[#ecf7e8]"><div className="text-xs font-semibold text-[#346042]">{new Date(post.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div><div className="mt-1 line-clamp-2 text-sm font-medium text-[#302920]">{scheduledPostDisplayTitle(post)}</div></button>)}</div></div>; })}</div></div>
            )}
          </section>

          <aside className="space-y-4">
            <Panel title="Review & Publish Flow"><SectionLabel>Selected Draft Actions</SectionLabel><div className="grid grid-cols-3 gap-3"><ActionButton disabled={!canSave} onClick={handleSave}>Save</ActionButton><ActionButton disabled={!selectedDraft} onClick={() => selectedDraft && handleStatus(selectedDraft.id, 'approve')}>Approve</ActionButton><ActionButton disabled={!selectedDraft} onClick={() => selectedDraft && handleStatus(selectedDraft.id, 'reject')}>Reject</ActionButton></div><div className="mt-3"><ActionButton disabled={!selectedDraft} onClick={() => void handleDeleteEverywhere()}>Delete from everywhere</ActionButton></div><div className="mt-3 grid grid-cols-2 gap-3"><ActionButton disabled={filteredDrafts.length === 0} onClick={() => void handleBulkStatus('approve')}>Approve all</ActionButton><ActionButton disabled={filteredDrafts.length === 0} onClick={() => void handleBulkStatus('reject')}>Reject all</ActionButton></div>{actionMessage ? <InlineMessage tone={messageTone(actionMessage)}>{actionMessage}</InlineMessage> : null}</Panel>
            <Panel title="Workflow Gate"><div className="space-y-3"><GateRow label="All drafts reviewed" value={`${reviewedCount} / ${drafts.length}`} done={allReviewed} /><GateRow label="Dry-run completed successfully" value={dryRunResult?.ok ? 'OK' : 'Pending'} done={Boolean(dryRunResult?.ok)} /><GateRow label="Ready to schedule" value={canSchedule ? 'Unlocked' : 'Locked'} done={canSchedule} /></div><p className="mt-3 text-sm text-[#6d6255]">Imported date/time: {selectedDraft?.scheduleMeta?.date ?? '—'} {selectedDraft?.scheduleMeta?.time_local ?? ''} {selectedDraft?.scheduleMeta?.timezone ?? ''}</p>{scheduleBlockReason ? <InlineMessage tone="warn">{scheduleBlockReason}</InlineMessage> : null}<button type="button" disabled={!canRunDryRun} onClick={handleDryRun} className="mt-4 w-full rounded-2xl border border-[#d8cec1] bg-[#f3f0ea] px-4 py-4 font-medium disabled:cursor-not-allowed disabled:opacity-50">{runningDryRun ? 'Running dry-run…' : 'Run dry-run'}</button><button type="button" disabled={!canSchedule} onClick={() => void handleSchedule()} className={cx('mt-3 w-full rounded-2xl border px-4 py-4 font-medium transition', canSchedule ? 'border-[#7bb287] bg-[#5d8f68] text-white hover:bg-[#4f7e5a]' : 'border-[#d8cec1] bg-white text-[#9c958c] disabled:cursor-not-allowed disabled:opacity-50')}>Schedule approved posts</button><p className="mt-3 text-sm text-[#6d6255]">Schedule unlocks after successful dry-run and reviewed drafts.</p>{dryRunMessage ? <InlineMessage tone={dryRunMessage.toLowerCase().includes('completed') || dryRunMessage.toLowerCase().includes('ok') ? 'ok' : 'warn'}>{dryRunMessage}</InlineMessage> : null}</Panel>
            <Panel title="Dry-run result (body-only payload)"><div className="mb-3 flex items-center justify-between gap-3"><div className="text-sm font-medium text-[#4d443a]">{dryRunResult ? 'Local payload preview' : 'Run dry-run to preview body-only payload.'}</div>{dryRunResult?.ok ? <StatusPill label="Dry-run OK" tone="ok" /> : null}</div><pre className="overflow-x-auto rounded-2xl border border-[#ddd4c8] bg-white p-4 text-sm leading-6 text-[#2c2926]">{JSON.stringify(dryRunResult?.payload ?? { dryRun: true, bufferCalled: false, posts: [] }, null, 2)}</pre><div className="mt-3 flex flex-wrap gap-2 text-sm"><StatusPill label="body only" tone="muted" /><StatusPill label={`bufferCalled: ${dryRunResult?.bufferCalled ?? false}`} tone="muted" /></div></Panel>
          </aside>
        </section>
      </div>
      {selectedCalendarPost ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onClick={() => setSelectedCalendarPost(null)}><div className="w-full max-w-2xl rounded-[30px] border border-[#ddd4c8] bg-[#fbfaf7] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.22)]" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b7268]">Scheduled post</div><h3 className="mt-2 text-2xl font-semibold text-[#302920]">{scheduledPostDisplayTitle(selectedCalendarPost)}</h3><p className="mt-2 text-sm text-[#6d6255]">{new Date(selectedCalendarPost.scheduledAt).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div><button type="button" className="rounded-full border border-[#d8cec1] bg-white px-4 py-2 text-sm font-medium text-[#4d443a] hover:bg-[#f6f1ea]" onClick={() => setSelectedCalendarPost(null)}>Close</button></div><div className="mt-6 rounded-3xl border border-[#e4dbcf] bg-white p-5"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b7268]">Content</div><div className="mt-3 whitespace-pre-wrap text-[1rem] leading-7 text-[#2c2926]">{selectedCalendarPost.body || 'No body yet.'}</div></div></div></div> : null}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[28px] border border-[#ddd4c8] bg-[#faf8f4] p-4 shadow-[0_10px_30px_rgba(60,40,20,0.06)]"><div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#7b7268]">{title}</div>{children}</section>; }
function SectionLabel({ children }: { children: React.ReactNode }) { return <div className="mb-3 text-sm font-semibold text-[#302920]">{children}</div>; }
function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'muted' }) { const toneClass = tone === 'ok' ? 'bg-[#edf6ea] text-[#346042]' : tone === 'warn' ? 'bg-[#fff2e6] text-[#8a5a20]' : 'bg-white text-[#4d443a]'; return <div className={cx('rounded-2xl border border-[#ddd4c8] px-4 py-3 font-medium', toneClass)}>{label}</div>; }
function StatusBadge({ status }: { status: DraftStatus }) { const label = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : status === 'needs_review' ? 'Needs review' : 'Draft'; const tone = status === 'approved' ? 'bg-[#eef7eb] text-[#2e6339]' : status === 'rejected' ? 'bg-[#f7ece9] text-[#824336]' : status === 'needs_review' ? 'bg-[#faf0dc] text-[#8d611d]' : 'bg-[#f3efea] text-[#4d443a]'; return <span className={cx('rounded-full px-3 py-1 text-sm font-medium', tone)}>{label}</span>; }
function GateRow({ label, value, done }: { label: string; value: string; done: boolean }) { return <div className="flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-3"><div className={cx('flex h-6 w-6 items-center justify-center rounded-full border', done ? 'border-[#2d2b29] bg-[#2d2b29] text-white' : 'border-[#cfc5b8] bg-white text-transparent')}>•</div><span>{label}</span></div><span className="font-medium text-[#5f554a]">{value}</span></div>; }
function ActionButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void | Promise<void> }) { return <button type="button" disabled={disabled} onClick={onClick} className="rounded-2xl border border-[#d8cec1] bg-white px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
function InlineMessage({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'ok' | 'warn' | 'error' | 'info' }) {
  const toneClass = tone === 'ok' ? 'border-[#cfe4d2] bg-[#edf6ea] text-[#346042]' : tone === 'warn' ? 'border-[#eadab8] bg-[#fff7e6] text-[#8d611d]' : tone === 'error' ? 'border-[#e3c4c0] bg-[#fbefed] text-[#8a3f35]' : 'border-[#ddd4c8] bg-white text-[#5e5448]';
  return <p className={cx('mt-3 rounded-2xl border px-4 py-3 text-sm', toneClass)}>{children}</p>;
}
