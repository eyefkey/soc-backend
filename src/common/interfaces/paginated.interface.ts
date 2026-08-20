export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    skip: number;
    take: number;
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  skip: number,
  take: number,
): Paginated<T> {
  return {
    data,
    meta: {
      total,
      skip,
      take,
    },
  };
}
