import { readFile, writeFile } from "node:fs/promises";

export async function readManifest(manifestPath) {
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    throw new Error("Invalid stage1 manifest format: expected { items: [] }");
  }
  return parsed;
}

export function selectReadyItems(items, args) {
  return items
    .filter((item) => item?.stage1?.status === "ready")
    .filter((item) => (args.codes ? args.codes.has(item.shortCode) : true))
    .slice(args.from, args.limit ? args.from + args.limit : undefined);
}

export async function writeStage2Manifest({
  manifestPath,
  manifest,
  selectedItems,
  owner,
  args,
  seededAudienceUsers,
  dryRun,
}) {
  if (dryRun) {
    return;
  }

  const seededAt = new Date().toISOString();
  for (const item of selectedItems) {
    item.hints = item.hints ?? {};
    item.hints.uploaderHint = owner.id;
    if (!item.hints.titleHint) {
      item.hints.titleHint = `Seed video ${item.shortCode}`;
    }
    item.stage2 = {
      status: "seeded",
      uploaderId: owner.id,
      channelId: owner.channelId,
      seededAt,
    };
  }

  manifest.stage2 = {
    updatedAt: seededAt,
    selectedCount: selectedItems.length,
    seededAudienceUsers,
    seedOwner: {
      id: owner.id,
      email: owner.email,
      password: owner.password,
    },
    dryRun,
    from: args.from,
    limit: args.limit,
    codes: args.codes ? Array.from(args.codes).sort() : null,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
