export type PartnerFavoriteRepositoryContext = {
  memberId: string;
};

export interface PartnerFavoriteRepository {
  getFavoriteCounts(partnerIds: string[]): Promise<Map<string, number>>;
  getMemberFavoritePartnerIds(
    memberId: string,
    partnerIds?: string[],
  ): Promise<Set<string>>;
  setMemberFavorite(
    memberId: string,
    partnerId: string,
    favorite: boolean,
  ): Promise<void>;
}
