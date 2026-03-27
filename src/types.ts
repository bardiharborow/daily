export type UpdatesByCategory = Map<string, Array<string>>;

export interface Plugin {
  fetchUpdatesByCategory(since: string): Promise<UpdatesByCategory>;
}
