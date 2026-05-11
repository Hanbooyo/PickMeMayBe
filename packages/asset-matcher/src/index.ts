import type {
  Participant,
  VisualAsset,
  VisualAssetMatchMethod,
} from "../../shared/src/index.js";

export type ImageResource = {
  key: string;
  path: string;
};

export type MatchVisualAssetsOptions = {
  anonymousImagePath: string;
};

export function matchVisualAssets(
  participants: Participant[],
  resources: ImageResource[],
  options: MatchVisualAssetsOptions,
): VisualAsset[] {
  const resourceIndex = createResourceIndex(resources);
  const nameCounts = countByNormalizedName(participants);

  return participants.map((participant) => {
    const match = findResourceMatch(participant, nameCounts, resourceIndex);

    if (!match) {
      return {
        participantId: participant.id,
        imagePath: options.anonymousImagePath,
        status: "anonymous",
        matchedBy: "fallback",
      };
    }

    return {
      participantId: participant.id,
      imagePath: match.resource.path,
      status: "matched",
      matchedBy: match.matchedBy,
    };
  });
}

function createResourceIndex(
  resources: ImageResource[],
): Map<string, ImageResource> {
  const index = new Map<string, ImageResource>();

  resources.forEach((resource) => {
    index.set(normalizeLookupKey(resource.key), resource);
  });

  return index;
}

function countByNormalizedName(participants: Participant[]): Map<string, number> {
  const counts = new Map<string, number>();

  participants.forEach((participant) => {
    const key = normalizeLookupKey(participant.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return counts;
}

function findResourceMatch(
  participant: Participant,
  nameCounts: Map<string, number>,
  resourceIndex: Map<string, ImageResource>,
):
  | {
      resource: ImageResource;
      matchedBy: VisualAssetMatchMethod;
    }
  | undefined {
  const nameKey = normalizeLookupKey(participant.name);
  const isDuplicateName = (nameCounts.get(nameKey) ?? 0) > 1;

  if (!isDuplicateName) {
    const nameMatch = resourceIndex.get(nameKey);
    if (nameMatch) {
      return { resource: nameMatch, matchedBy: "name" };
    }
  }

  const emailMatch = participant.email
    ? resourceIndex.get(normalizeLookupKey(participant.email))
    : undefined;

  if (emailMatch) {
    return { resource: emailMatch, matchedBy: "email" };
  }

  const departmentMatch = participant.department
    ? resourceIndex.get(
        normalizeLookupKey(`${participant.name}-${participant.department}`),
      )
    : undefined;

  if (departmentMatch) {
    return { resource: departmentMatch, matchedBy: "name-and-department" };
  }

  return undefined;
}

export function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\.(png|jpe?g|webp|svg)$/i, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
