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
  scheduleMeta: {
    date?: string;
    time_local?: string;
    timezone?: string;
  } | null;
  sourceContext: unknown;
};

type ImportValidation = {
  ok: boolean;
  errors?: string[];
};

type DryRunResult = {
  ok: boolean;
  dryRun: true;
  bufferCalled: false;
  characterCount: number;
  limit: number;
  errors?: string[];
  payload: {
    brand: string;
    week: string | null;
    posts: Array<{ at: string | null; body: string }>;
  };
};

type ScheduledPost = {
  id: string;
  brandSlug: string;
  draftId: string | null;
  title: string;
  body: string;
  scheduledAt: string;
  externalStatus: string;
  payload: unknown;
  createdAt: string;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type WorkflowStep = {
  label: string;
  detail: string;
  done: boolean;
};

const MAX_BODY_LENGTH = 140;
const statuses: Array<{ value: 'all' | DraftStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_review', label: 'Needs review' }
];

const brandMeta = {
  textifai: { initials: 'T', short: 'TEXTIFAI' },
  ont: { initials: 'O', short: 'ONT' },
  bitcoinpendium: { initials: 'DB', short: 'BITCOINPENDIUM' }
} as const;

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
  return uniqueErrors
    .slice(0, 6)
    .map((error) => validationHints[error] ?? error)
    .join(' ');
}

function formatScheduledLabel(draft: Draft) {
  if (!draft.scheduleMeta?.date) return 'No date';
  const date = new Date(`${draft.scheduleMeta.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return draft.scheduleMeta.date;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function HomePage() {
  const [selectedBrand, setSelectedBrand] = useState<(typeof brands)[number]['slug']>(brands[0].slug);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | DraftStatus>('all');
  const [importText, setImportText] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [apiHealthy, setApiHealthy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunMessage, setDryRunMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  const selectedBrandConfig = brands.find((brand) => brand.slug === selectedBrand) ?? brands[0];
  const filteredDrafts = useMemo(() => (
    filterStatus === 'all' ? drafts : drafts.filter((draft) => draft.status === filterStatus)
  ), [drafts, filterStatus]);

  const selectedDraft = useMemo(() => (
    drafts.find((draft) => draft.id === selectedDraftId) ?? filteredDrafts[0] ?? drafts[0] ?? null
  ), [drafts, filteredDrafts, selectedDraftId]);

  const reviewedCount = useMemo(() => drafts.filter((draft) => draft.status === 'approved' || draft.status === 'rejected').length, [drafts]);
  const approvedCount = useMemo(() => drafts.filter((draft) => draft.status === 'approved').length, [drafts]);
  const rejectedCount = useMemo(() => drafts.filter((draft) => draft.status === 'rejected').length, [drafts]);
  const draftCount = useMemo(() => drafts.filter((draft) => draft.status === 'draft' || draft.status === 'needs_review').length, [drafts]);
  const allReviewed = drafts.length > 0 && drafts.every((draft) => draft.status === 'approved' || draft.status === 'rejected');
  const bodyCount = editorBody.length;
  const bodyOverLimit = bodyCount > MAX_BODY_LENGTH;
  const canSave = Boolean(selectedDraft) && !saving;
  const canRunDryRun = allReviewed && drafts.length > 0 && !runningDryRun;
  const canSchedule = Boolean(dryRunResult?.ok);
  const visibleScheduledPosts = useMemo(() => scheduledPosts.filter((post) => post.brandSlug === selectedBrand), [scheduledPosts, selectedBrand]);
  const workflowSteps: WorkflowStep[] = [
    { label: 'Import', detail: importMessage ?? 'Week plan imported', done: drafts.length > 0 },
    { label: 'Review drafts', detail: allReviewed ? 'All drafts reviewed' : 'Approve or reject all drafts', done: allReviewed },
    { label: 'Dry-run', detail: dryRunResult?.ok ? 'Validated locally' : 'Validate with local dry-run', done: Boolean(dryRunResult?.ok) },
    { label: 'Schedule', detail: canSchedule ? 'Ready to schedule' : 'Schedule approved posts', done: false }
  ];

  useEffect(() => {
    void loadDrafts(selectedBrand, { resetSelection: true });
  }, [selectedBrand]);

  useEffect(() => {
    void loadCalendar();
  }, []);

  useEffect(() => {
    if (!selectedDraft) {
      setEditorTitle('');
      setEditorBody('');
      return;
    }
    setSelectedDraftId(selectedDraft.id);
    setEditorTitle(selectedDraft.title ?? '');
    setEditorBody(selectedDraft.body ?? '');
  }, [selectedDraft?.id]);

  async function loadDrafts(brandSlug: string, options?: { resetSelection?: boolean }) {
    setLoadState('loading');
    setActionMessage(null);
    setDryRunMessage(null);
    if (options?.resetSelection) setDryRunResult(null);
    try {
      const response = await fetch(`/api/drafts?brandSlug=${brandSlug}`);
      const payload = await response.json();
      if (!response.ok) throw new Error((payload.errors ?? ['load_failed']).join(', '));
      setApiHealthy(true);
      setDrafts(payload.drafts);
      setSelectedDraftId((current) => (options?.resetSelection ? payload.drafts[0]?.id ?? null : current ?? payload.drafts[0]?.id ?? null));
      setLoadState('ready');
    } catch (error) {
      setApiHealthy(false);
      setLoadState('error');
      setDrafts([]);
      setSelectedDraftId(null);
      setActionMessage(error instanceof Error ? error.message : 'Load failed');
    }
  }

  async function postJson<T>(url: string, body?: unknown, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      method: init?.method ?? 'POST',
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init
    });
    const payload = await response.json();
    if (!response.ok) throw new Error((payload.errors ?? ['request_failed']).join(', '));
    return payload as T;
  }

  async function loadCalendar() {
    try {
      const response = await fetch('/api/calendar');
      const payload = await response.json();
      if (!response.ok) throw new Error((payload.errors ?? ['calendar_load_failed']).join(', '));
      setScheduledPosts(payload.scheduledPosts ?? []);
    } catch {
      setScheduledPosts([]);
    }
  }

  async function handleValidateImport() {
    setValidationMessage(null);
    try {
      const json = JSON.parse(importText);
      const payload = await postJson<ImportValidation>('/api/import/week-plan/validate', { json });
      setValidationMessage(payload.ok ? 'JSON valid for selected import contract.' : formatValidationErrors(payload.errors));
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : validationHints.invalid_json);
    }
  }

  async function handleImport() {
    setImportMessage(null);
    setDryRunResult(null);
    try {
      const json = JSON.parse(importText);
      const payload = await postJson<{ ok: boolean; imported: number }>('/api/import/week-plan', { json });
      setImportMessage(`Imported ${payload.imported} drafts.`);
      await loadDrafts(selectedBrand, { resetSelection: true });
      await loadCalendar();
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Import failed');
    }
  }

  async function handleUploadJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.json') && file.type !== 'application/json') {
      setImportMessage('Only .json files are accepted.');
      return;
    }
    try {
      const text = await file.text();
      setImportText(text);
      setValidationMessage(null);
      setImportMessage(`Loaded ${file.name}.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Could not read JSON file');
    }
  }

  async function handleSave() {
    if (!selectedDraft) return;
    setSaving(true);
    setActionMessage(null);
    try {
      await postJson(`/api/drafts/${selectedDraft.id}`, { title: editorTitle, body: editorBody }, { method: 'PATCH' });
      setActionMessage('Draft saved.');
      await loadDrafts(selectedBrand);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: string, status: 'approve' | 'reject' | 'needs-review' | 'back-to-draft') {
    setActionMessage(null);
    setDryRunResult(null);
    try {
      await postJson(`/api/drafts/${id}/${status}`);
      setActionMessage(status === 'approve' ? 'Draft approved.' : status === 'reject' ? 'Draft rejected.' : 'Draft updated.');
      await loadDrafts(selectedBrand);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Status update failed');
    }
  }

  async function handleBulkStatus(status: 'approve' | 'reject') {
    const targets = drafts.filter((draft) => draft.status !== (status === 'approve' ? 'approved' : 'rejected'));
    for (const draft of targets) {
      await postJson(`/api/drafts/${draft.id}/${status}`);
    }
    setActionMessage(status === 'approve' ? 'All drafts approved.' : 'All drafts rejected.');
    setDryRunResult(null);
    await loadDrafts(selectedBrand);
  }

  async function handleDryRun() {
    if (!canRunDryRun) return;
    setRunningDryRun(true);
    setDryRunMessage(null);
    try {
      const posts = [] as DryRunResult['payload']['posts'];
      for (const draft of drafts.filter((item) => item.status === 'approved')) {
        const payload = await postJson<{
          ok: boolean;
          dryRun: true;
          bufferCalled: false;
          publishText: string;
          characterCount: number;
          limit: number;
          errors?: string[];
          draft: Draft;
        }>(`/api/drafts/${draft.id}/dry-run`);
        if (!payload.ok) throw new Error((payload.errors ?? ['dry_run_failed']).join(', '));
        posts.push({ at: draft.scheduleMeta?.date ?? draft.scheduledAt, body: payload.publishText });
      }
      setDryRunResult({
        ok: true,
        dryRun: true,
        bufferCalled: false,
        characterCount: Math.max(...posts.map((post) => post.body.length), 0),
        limit: MAX_BODY_LENGTH,
        payload: {
          brand: selectedBrandConfig.name,
          week: drafts[0]?.scheduleMeta?.date ?? null,
          posts
        }
      });
      setDryRunMessage('Dry-run completed locally. Buffer untouched.');
    } catch (error) {
      setDryRunResult(null);
      setDryRunMessage(error instanceof Error ? error.message : 'Dry-run failed');
    } finally {
      setRunningDryRun(false);
    }
  }

  function handleSchedule() {
    if (!canSchedule) return;
    setActionMessage('Scheduling not wired in this slice. No Buffer call made.');
  }

  return (
    <main className="min-h-screen bg-[#f3f0ea] text-[#211d18]">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col px-6 pb-6 pt-4 lg:px-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[#ddd4c8] bg-[#faf8f4] px-5 py-4 shadow-[0_12px_30px_rgba(60,40,20,0.08)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3a3837] text-lg font-semibold text-white">SC</div>
            <div>
              <p className="m-0 text-[15px] font-semibold tracking-[0.14em] text-[#6d6255]">Social Controller</p>
            </div>
            <label className="ml-3 flex items-center gap-3 rounded-2xl border border-[#ddd4c8] bg-white px-4 py-3">
              <span className="text-sm font-medium text-[#5d5247]">Brand:</span>
              <select
                aria-label="Brand selector"
                className="border-0 bg-transparent pr-7 text-sm font-medium outline-none"
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value as typeof brands[number]['slug'])}
              >
                {brands.map((brand) => <option key={brand.slug} value={brand.slug}>{brand.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusPill label={`API: ${apiHealthy ? 'Operational' : 'Error'}`} tone={apiHealthy ? 'ok' : 'warn'} />
            <StatusPill label="Buffer: Disconnected" tone="muted" />
            <StatusPill label={`Drafts: ${drafts.length}`} tone="muted" />
            <StatusPill label={`Errors: ${actionMessage || dryRunMessage ? 1 : 0}`} tone={actionMessage || dryRunMessage ? 'warn' : 'muted'} />
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ddd4c8] bg-white font-semibold text-[#5a5045]">DA</div>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <aside className="space-y-4">
            <Panel title="Brands & Import">
              <div className="space-y-3">
                <SectionLabel>Select brand</SectionLabel>
                {brands.map((brand) => {
                  const meta = brandMeta[brand.slug];
                  const active = brand.slug === selectedBrand;
                  return (
                    <button
                      key={brand.slug}
                      type="button"
                      onClick={() => setSelectedBrand(brand.slug)}
                      className={cx('flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition', active ? 'border-[#2d2b29] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.06)]' : 'border-[#ddd4c8] bg-[#fbfaf7] hover:bg-white')}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d7d0c5] bg-[#f0ede7] text-sm font-semibold text-[#4c443a]">{meta.initials}</div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{brand.name}</div>
                        <div className="truncate text-xs tracking-[0.16em] text-[#7c7267]">{meta.short}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Import week plan JSON">
              <label className="mb-3 flex w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#cfc5b8] bg-[#fbfaf7] px-4 py-3 text-sm font-medium text-[#4d443a] transition hover:bg-white">
                Upload `.json`
                <input
                  aria-label="Upload JSON file"
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleUploadJson}
                />
              </label>
              <textarea
                aria-label="Week plan JSON"
                className="min-h-[190px] w-full rounded-2xl border border-dashed border-[#cfc5b8] bg-white px-4 py-4 text-sm leading-6 outline-none placeholder:text-[#9d9287]"
                placeholder="Paste JSON here"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={handleValidateImport} className="flex-1 rounded-xl border border-[#cfc5b8] bg-white px-4 py-3 font-medium">Validate JSON</button>
                <button type="button" onClick={handleImport} className="flex-1 rounded-xl bg-[#8d8b8a] px-4 py-3 font-medium text-white">Import</button>
              </div>
              <p className="mt-3 text-sm text-[#6d6255]">Imports week plan for selected brand.</p>
              {validationMessage ? <InlineMessage>{validationMessage}</InlineMessage> : null}
              {importMessage ? <InlineMessage>{importMessage}</InlineMessage> : null}
            </Panel>

            <Panel title="Workflow progress">
              <div className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div key={step.label} className="flex items-start gap-3">
                    <div className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', step.done ? 'border-[#2d2b29] bg-[#2d2b29] text-white' : 'border-[#cfc5b8] bg-white text-[#4c443a]')}>{index + 1}</div>
                    <div>
                      <div className="font-semibold">{step.label}</div>
                      <div className="text-sm text-[#6d6255]">{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>

          <section className="rounded-[30px] border border-[#ddd4c8] bg-[#faf8f4] p-4 shadow-[0_18px_40px_rgba(60,40,20,0.08)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4 px-2 pt-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-[#7b7268]">Draft workspace</div>
                <h1 className="m-0 mt-2 text-[2rem] font-semibold tracking-[-0.03em]">Week Drafts</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label={`${drafts.length} drafts / ${approvedCount} approved / ${rejectedCount} rejected`} tone="muted" />
                <select
                  aria-label="Status filter"
                  className="rounded-2xl border border-[#d9d0c4] bg-white px-4 py-3 text-sm"
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value as 'all' | DraftStatus)}
                >
                  {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <div className="rounded-2xl border border-[#d9d0c4] bg-white px-4 py-3 text-sm font-medium">June 2026</div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3 rounded-[26px] border border-[#e1d8cc] bg-white p-3">
                {loadState === 'loading' ? <p className="px-3 py-4 text-sm text-[#6d6255]">Loading drafts…</p> : null}
                {loadState !== 'loading' && filteredDrafts.length === 0 ? <p className="px-3 py-4 text-sm text-[#6d6255]">No drafts yet for this brand.</p> : null}
                {filteredDrafts.map((draft) => {
                  const active = draft.id === selectedDraft?.id;
                  return (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => setSelectedDraftId(draft.id)}
                      className={cx('w-full rounded-2xl border px-4 py-4 text-left transition', active ? 'border-[#2d2b29] bg-[#fbfaf7] shadow-[0_10px_24px_rgba(0,0,0,0.06)]' : 'border-[#e7dfd4] bg-white hover:bg-[#f9f6f1]')}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="text-sm text-[#5e5448]">{formatScheduledLabel(draft)}</div>
                        <StatusBadge status={draft.status} />
                      </div>
                      <div className="mb-2 text-[1.05rem] font-semibold leading-6">{draft.title || 'Untitled draft'}</div>
                      <div className="line-clamp-2 text-sm leading-6 text-[#4d443a]">{draft.body || 'No body yet.'}</div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 rounded-[26px] border border-[#e1d8cc] bg-white p-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setActiveTab('editor')} className={cx('rounded-xl px-5 py-3 font-medium', activeTab === 'editor' ? 'bg-[#f2efe8] shadow-inner' : 'bg-transparent text-[#6d6255]')}>Editor</button>
                  <button type="button" onClick={() => setActiveTab('preview')} className={cx('rounded-xl px-5 py-3 font-medium', activeTab === 'preview' ? 'bg-[#f2efe8] shadow-inner' : 'bg-transparent text-[#6d6255]')}>Preview</button>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#302920]">
                    Internal Title <span className="font-normal text-[#7a7066]">(not published)</span>
                    <input
                      aria-label="Internal Title"
                      className="mt-2 w-full rounded-2xl border border-[#dcd3c7] bg-[#fffdfa] px-4 py-3 outline-none"
                      value={editorTitle}
                      onChange={(event) => setEditorTitle(event.target.value)}
                    />
                  </label>
                  <p className="text-sm text-[#857a6f]">Title is internal only. It is not published.</p>
                </div>

                {activeTab === 'editor' ? (
                  <label className="block text-sm font-semibold text-[#302920]">
                    Body
                    <textarea
                      aria-label="Body"
                      className="mt-2 min-h-[240px] w-full rounded-3xl border border-[#dcd3c7] bg-[#fffdfa] px-5 py-4 text-[1.05rem] leading-8 outline-none"
                      value={editorBody}
                      onChange={(event) => setEditorBody(event.target.value)}
                    />
                    <div className="mt-2 flex justify-end text-right text-sm font-medium text-[#5a5147]">{bodyCount} / {MAX_BODY_LENGTH}</div>
                  </label>
                ) : (
                  <div className="min-h-[240px] rounded-3xl border border-[#dcd3c7] bg-[#fffdfa] px-5 py-4 text-[1.05rem] leading-8 whitespace-pre-wrap">{editorBody || 'Preview empty.'}</div>
                )}

                <div className="rounded-2xl border border-[#ddd4c8] bg-[#faf8f4] px-4 py-3 text-sm text-[#4d443a]">Only body is sent to X.</div>

                {bodyOverLimit ? (
                  <div className="rounded-3xl border border-dashed border-[#d0c2b1] bg-[#fbf7f2] px-5 py-4">
                    <div className="text-base font-medium">Over-limit example (not active)</div>
                    <p className="mb-2 text-sm text-[#6d6255]">This body is {bodyCount} / {MAX_BODY_LENGTH} characters. Reduce to 140 or fewer.</p>
                    <div className="text-right text-sm font-medium text-[#5a5147]">{bodyCount} / {MAX_BODY_LENGTH}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <Panel title="Review & Publish Flow">
              <SectionLabel>Selected Draft Actions</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <ActionButton disabled={!canSave} onClick={handleSave}>Save</ActionButton>
                <ActionButton disabled={!selectedDraft} onClick={() => selectedDraft && handleStatus(selectedDraft.id, 'approve')}>Approve</ActionButton>
                <ActionButton disabled={!selectedDraft} onClick={() => selectedDraft && handleStatus(selectedDraft.id, 'reject')}>Reject</ActionButton>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ActionButton disabled={drafts.length === 0} onClick={() => void handleBulkStatus('approve')}>Approve all</ActionButton>
                <ActionButton disabled={drafts.length === 0} onClick={() => void handleBulkStatus('reject')}>Reject all</ActionButton>
              </div>
            </Panel>

            <Panel title="Workflow Gate">
              <div className="space-y-3">
                <GateRow label="All drafts reviewed" value={`${reviewedCount} / ${drafts.length}`} done={allReviewed} />
                <GateRow label="Dry-run completed successfully" value={dryRunResult?.ok ? 'OK' : 'Pending'} done={Boolean(dryRunResult?.ok)} />
                <GateRow label="Ready to schedule" value={canSchedule ? 'Unlocked' : 'Locked'} done={canSchedule} />
              </div>
              <button type="button" disabled={!canRunDryRun} onClick={handleDryRun} className="mt-4 w-full rounded-2xl border border-[#d8cec1] bg-[#f3f0ea] px-4 py-4 font-medium disabled:cursor-not-allowed disabled:opacity-50">{runningDryRun ? 'Running dry-run…' : 'Run dry-run'}</button>
              <p className="mt-3 text-sm text-[#6d6255]">Unlocks when every draft is Approved or Rejected.</p>
              {dryRunMessage ? <InlineMessage>{dryRunMessage}</InlineMessage> : null}
            </Panel>

            <Panel title="Dry-run result (body-only payload)">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[#4d443a]">{dryRunResult ? 'Local payload preview' : 'Run dry-run to preview body-only payload.'}</div>
                {dryRunResult?.ok ? <StatusPill label="Dry-run OK" tone="ok" /> : null}
              </div>
              <pre className="overflow-x-auto rounded-2xl border border-[#ddd4c8] bg-white p-4 text-sm leading-6 text-[#2c2926]">{JSON.stringify(dryRunResult?.payload ?? { dryRun: true, bufferCalled: false, posts: [] }, null, 2)}</pre>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <StatusPill label="body only" tone="muted" />
                <StatusPill label={`bufferCalled: ${dryRunResult?.bufferCalled ?? false}`} tone="muted" />
              </div>
            </Panel>

            <Panel title="Schedule">
              <button type="button" disabled={!canSchedule} onClick={handleSchedule} className="w-full rounded-2xl border border-[#d8cec1] bg-[#f3f0ea] px-4 py-4 font-medium disabled:cursor-not-allowed disabled:opacity-50">Schedule approved posts</button>
              <p className="mt-3 text-sm text-[#6d6255]">Unlocks after successful dry-run.</p>
            </Panel>

            <Panel title="Single workflow column">
              <p className="text-sm text-[#4d443a]">Review → dry-run → schedule</p>
              {actionMessage ? <InlineMessage>{actionMessage}</InlineMessage> : null}
            </Panel>

            <Panel title="Scheduled calendar">
              <div className="space-y-3">
                {visibleScheduledPosts.length === 0 ? (
                  <p className="text-sm text-[#6d6255]">No scheduled posts in local DB yet. Calendar will populate after successful Buffer scheduling persists `ScheduledPost` rows.</p>
                ) : visibleScheduledPosts.map((post) => (
                  <div key={post.id} className="rounded-2xl border border-[#ddd4c8] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[#302920]">{new Date(post.scheduledAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      <StatusBadge status={'approved'} />
                    </div>
                    <div className="mt-2 text-sm font-medium text-[#302920]">{post.title}</div>
                    <div className="mt-1 line-clamp-3 text-sm leading-6 text-[#4d443a]">{post.body}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#7b7268]">{post.externalStatus}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#ddd4c8] bg-[#faf8f4] p-4 shadow-[0_10px_30px_rgba(60,40,20,0.06)]">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#7b7268]">{title}</div>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-sm font-semibold text-[#302920]">{children}</div>;
}

function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'muted' }) {
  const toneClass = tone === 'ok' ? 'bg-[#edf6ea] text-[#346042]' : tone === 'warn' ? 'bg-[#fff2e6] text-[#8a5a20]' : 'bg-white text-[#4d443a]';
  return <div className={cx('rounded-2xl border border-[#ddd4c8] px-4 py-3 font-medium', toneClass)}>{label}</div>;
}

function StatusBadge({ status }: { status: DraftStatus }) {
  const label = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : status === 'needs_review' ? 'Needs review' : 'Draft';
  const tone = status === 'approved' ? 'bg-[#eef7eb] text-[#2e6339]' : status === 'rejected' ? 'bg-[#f7ece9] text-[#824336]' : status === 'needs_review' ? 'bg-[#faf0dc] text-[#8d611d]' : 'bg-[#f3efea] text-[#4d443a]';
  return <span className={cx('rounded-full px-3 py-1 text-sm font-medium', tone)}>{label}</span>;
}

function GateRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3">
        <div className={cx('flex h-6 w-6 items-center justify-center rounded-full border', done ? 'border-[#2d2b29] bg-[#2d2b29] text-white' : 'border-[#cfc5b8] bg-white text-transparent')}>•</div>
        <span>{label}</span>
      </div>
      <span className="font-medium text-[#5f554a]">{value}</span>
    </div>
  );
}

function ActionButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void | Promise<void> }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-2xl border border-[#d8cec1] bg-white px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function InlineMessage({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#5e5448]">{children}</p>;
}
