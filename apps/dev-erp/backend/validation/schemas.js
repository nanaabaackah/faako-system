import { z } from "zod";
import { forgotPasswordInputSchema } from "@faako/validation";

export const loginSchema = z.object({
  email: z.string().min(1).max(254).email(),
  password: z.string().min(1).max(1024),
});

export const forgotPasswordSchema = forgotPasswordInputSchema;

export const setupAccountVerifySchema = z.object({
  token: z.string().min(1).max(2048),
});

export const setupAccountCompleteSchema = z.object({
  token: z.string().min(1).max(2048),
  password: z.string().min(8).max(1024),
});

export const publicBookingSchema = z.object({
  attendeeName: z.string().min(1).max(200).trim(),
  attendeeEmail: z.string().min(1).max(254).email(),
  title: z.string().min(1).max(300).trim(),
  description: z.string().max(2000).optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  location: z.string().max(500).optional(),
  meetingLink: z.string().url().max(2000).optional().or(z.literal("")),
});

export const productivityEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "entryDate must be YYYY-MM-DD"),
  plannedTasks: z.number().int().min(0).max(5000).optional(),
  completedTasks: z.number().int().min(0).max(5000).optional(),
  deepWorkMinutes: z.number().int().min(0).max(2880).optional(),
  focusBlocks: z.number().int().min(0).max(200).optional(),
  energyLevel: z.number().int().min(1).max(10).nullable().optional(),
  blockers: z.string().max(2000).nullable().optional(),
});

export const productivityTodoSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});
