import type { PartnerFavoriteRepository } from "@/lib/repositories/partner-favorite-repository";

type MockFavoriteRecord = {
  memberId: string;
  partnerId: string;
  createdAt: string;
  updatedAt: string;
};

type MockFavoriteStore = {
  favorites: MockFavoriteRecord[];
};

const seededFavorites: MockFavoriteRecord[] = [
  {
    memberId: "mock-student-14",
    partnerId: "health-001",
    createdAt: "2026-04-12T02:00:00.000Z",
    updatedAt: "2026-04-12T02:00:00.000Z",
  },
  {
    memberId: "mock-student-15",
    partnerId: "health-001",
    createdAt: "2026-04-12T03:00:00.000Z",
    updatedAt: "2026-04-12T03:00:00.000Z",
  },
  {
    memberId: "mock-staff-1",
    partnerId: "space-001",
    createdAt: "2026-04-13T03:00:00.000Z",
    updatedAt: "2026-04-13T03:00:00.000Z",
  },
];

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerFavoriteStore?: MockFavoriteStore;
};

function getStore() {
  if (!globalScope.__mockPartnerFavoriteStore) {
    globalScope.__mockPartnerFavoriteStore = {
      favorites: seededFavorites.map((favorite) => ({ ...favorite })),
    };
  }
  return globalScope.__mockPartnerFavoriteStore;
}

function normalizeIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export class MockPartnerFavoriteRepository
  implements PartnerFavoriteRepository
{
  async getFavoriteCounts(partnerIds: string[]) {
    const normalizedPartnerIds = normalizeIds(partnerIds);
    const counts = new Map<string, number>();
    for (const partnerId of normalizedPartnerIds) {
      counts.set(partnerId, 0);
    }
    for (const favorite of getStore().favorites) {
      if (!counts.has(favorite.partnerId)) {
        continue;
      }
      counts.set(favorite.partnerId, (counts.get(favorite.partnerId) ?? 0) + 1);
    }
    return counts;
  }

  async getMemberFavoritePartnerIds(
    memberId: string,
    partnerIds?: string[],
  ): Promise<Set<string>> {
    const normalizedPartnerIds = partnerIds ? normalizeIds(partnerIds) : [];
    return new Set(
      getStore().favorites
        .filter(
          (favorite) =>
            favorite.memberId === memberId &&
            (normalizedPartnerIds.length === 0 ||
              normalizedPartnerIds.includes(favorite.partnerId)),
        )
        .map((favorite) => favorite.partnerId),
    );
  }

  async setMemberFavorite(
    memberId: string,
    partnerId: string,
    favorite: boolean,
  ) {
    const store = getStore();
    const nextFavorites = store.favorites.filter(
      (item) => !(item.memberId === memberId && item.partnerId === partnerId),
    );

    if (favorite) {
      const now = new Date().toISOString();
      nextFavorites.unshift({
        memberId,
        partnerId,
        createdAt: now,
        updatedAt: now,
      });
    }

    store.favorites = nextFavorites;
  }
}
