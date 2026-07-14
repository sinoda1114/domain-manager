import { z } from "zod";

import { createDraftDomain } from "@/infrastructure/db/domain-repository";
import { ensureProviderTarget, listProviderTargets } from "@/infrastructure/providers/targets";
import { isAdmin } from "@/lib/auth";

const inputSchema = z.object({
  label: z.string().min(1).max(63),
  provider: z.string(),
  targetId: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });

  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "invalid_input" }, { status: 400 });

  try {
    const target = ensureProviderTarget(await listProviderTargets(), input.data);
    const domain = await createDraftDomain({
      label: input.data.label,
      provider: target.provider,
      providerTargetId: target.id,
      providerTargetName: target.name,
      requestedBy: "admin",
    });
    return Response.json({ domain }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "draft_creation_failed" }, { status: 400 });
  }
}
