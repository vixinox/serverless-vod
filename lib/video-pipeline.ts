import prisma from "@/lib/prisma";

const SHORTCODE_LENGTH = 11;
const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function hashString(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

async function generateUniqueShortCode(seedInput: string) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let seed = hashString(`${seedInput}:${attempt}`);
    let shortCode = "";

    for (let index = 0; index < SHORTCODE_LENGTH; index += 1) {
      seed = Math.imul(seed, 1664525) + 1013904223;
      const normalizedSeed = (seed >>> 0) % SHORTCODE_ALPHABET.length;
      shortCode += SHORTCODE_ALPHABET[normalizedSeed];
    }

    const existing = await prisma.video.findUnique({
      where: { shortCode },
      select: { id: true },
    });

    if (!existing) {
      return shortCode;
    }
  }

  throw new Error("无法生成唯一短码");
}

export async function ensureChannelForUser(userId: string, fallbackName: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      channel: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("用户不存在");
  }

  if (user.channel?.id) {
    return user.channel.id;
  }

  const base = slugify(user.name || fallbackName || "channel") || "channel";
  const candidate = `${base}-${user.id.slice(0, 6)}`;

  const channel = await prisma.channel.create({
    data: {
      ownerId: user.id,
      name: candidate,
      description: `${user.name || fallbackName} 的频道`,
    },
    select: {
      id: true,
    },
  });

  return channel.id;
}

export async function createUploadVideoDraft(params: {
  userId: string;
  title: string;
  filename: string;
  type: "LONG" | "SHORT";
}) {
  const channelId = await ensureChannelForUser(params.userId, params.title);
  const shortCode = await generateUniqueShortCode(`${params.userId}:${params.filename}:${Date.now()}`);

  return prisma.video.create({
    data: {
      userId: params.userId,
      channelId,
      title: params.title,
      shortCode,
      type: params.type,
      visibility: "PRIVATE",
      processingStatus: "UPLOADING",
    },
    select: {
      id: true,
      shortCode: true,
      channelId: true,
    },
  });
}