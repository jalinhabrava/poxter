import { PrismaClient } from '@prisma/client';
import { validateWeekPlanContract } from '../domain/week-plan-contract';

type ImportMode = 'upsert_by_external_id' | 'replace_week';

const prisma = new PrismaClient();

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function computeScheduledAt(slot: any, fallbackTimezone?: string | null) {
  if (!slot?.date || !slot?.time_local) return null;
  const timezone = slot.timezone ?? fallbackTimezone ?? null;
  const raw = timezone && timezone !== 'UTC' ? `${slot.date}T${slot.time_local}:00` : `${slot.date}T${slot.time_local}:00Z`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveDraftSchedule(draft: any, slotsById: Map<string, any>, fallbackWeekTimezone?: string | null) {
  const slot = typeof draft?.slot_id === 'string' ? slotsById.get(draft.slot_id) ?? null : null;
  if (slot) {
    const scheduledAt = computeScheduledAt(slot, fallbackWeekTimezone);
    return {
      slotId: draft.slot_id,
      date: slot.date ?? null,
      timeLocal: slot.time_local ?? null,
      timezone: slot.timezone ?? fallbackWeekTimezone ?? null,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null
    };
  }

  const fallbackSlot = draft?.slot ?? draft?.schedule ?? draft?.schedule_slot ?? null;
  const fallbackDate = fallbackSlot?.date ?? draft?.scheduled_date ?? draft?.date ?? null;
  const fallbackTime = fallbackSlot?.time_local ?? draft?.scheduled_time ?? draft?.time_local ?? null;
  const fallbackTimezone = fallbackSlot?.timezone ?? draft?.timezone ?? fallbackWeekTimezone ?? null;
  const scheduledAt = computeScheduledAt({ date: fallbackDate, time_local: fallbackTime, timezone: fallbackTimezone }, fallbackWeekTimezone);
  return {
    slotId: draft?.slot_id ?? null,
    date: fallbackDate,
    timeLocal: fallbackTime,
    timezone: fallbackTimezone,
    scheduledAt: scheduledAt ? scheduledAt.toISOString() : null
  };
}

export async function importWeekPlan(input: unknown, mode: ImportMode = 'upsert_by_external_id') {
  const validation = validateWeekPlanContract(input);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const plan = input as any;
  const brand = await prisma.brand.findUnique({ where: { slug: plan.brand.slug } });
  if (!brand) return { ok: false, errors: ['brand.slug'] };

  const slots = asArray(plan.slots);
  const drafts = asArray(plan.drafts);
  const sourceContext = asArray(plan.source_context ?? plan.sourceContext);
  const safetyWarnings = asArray(plan.safety_warnings ?? plan.safetyWarnings);
  const slotById = new Map(slots.map((slot: any) => [slot.id, slot]));

  if (mode === 'replace_week') {
    await prisma.draft.deleteMany({ where: { brandId: brand.id } });
    await prisma.sourceItem.deleteMany({ where: { brandId: brand.id } });
    await prisma.safetyWarning.deleteMany({ where: { brandId: brand.id } });
  }

  for (const item of sourceContext) {
    await prisma.sourceItem.create({
      data: {
        brandId: brand.id,
        externalId: item?.external_id ?? item?.externalId ?? null,
        kind: item?.kind ?? item?.type ?? null,
        payload: JSON.stringify(item)
      }
    });
  }

  for (const warning of safetyWarnings) {
    await prisma.safetyWarning.create({
      data: {
        brandId: brand.id,
        message: warning?.message ?? String(warning ?? 'warning'),
        payload: JSON.stringify(warning)
      }
    });
  }

  for (const draft of drafts) {
    const scheduleMeta = resolveDraftSchedule(draft, slotById, plan.week?.timezone ?? null);
    const scheduledAt = scheduleMeta.scheduledAt ? new Date(scheduleMeta.scheduledAt) : null;
    const data = {
      brandId: brand.id,
      externalId: draft.external_id,
      slotId: draft.slot_id,
      platform: draft.platform,
      format: draft.format,
      title: draft.title,
      body: draft.body ?? null,
      threadPosts: draft.thread_posts ? JSON.stringify(draft.thread_posts) : null,
      status: draft.status,
      sourceContext: draft.source_context ? JSON.stringify(draft.source_context) : null,
      scheduleMeta: JSON.stringify(scheduleMeta),
      scheduledAt
    };

    if (mode === 'upsert_by_external_id') {
      await prisma.draft.upsert({ where: { externalId: draft.external_id }, update: data, create: data });
    } else {
      await prisma.draft.create({ data });
    }
  }

  return { ok: true, imported: drafts.length };
}

export { prisma };
