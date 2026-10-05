// Sequential iteration preserves write ordering within a database transaction.
export async function mapAsync<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R> | R): Promise<R[]> {
  const result: R[] = [];
  for (let index = 0; index < items.length; index++) result.push(await fn(items[index], index));
  return result;
}
export async function forEachAsync<T>(items: readonly T[], fn: (item: T, index: number) => unknown): Promise<void> {
  for (let index = 0; index < items.length; index++) await fn(items[index], index);
}
export async function filterAsync<T>(items: readonly T[], fn: (item: T, index: number) => unknown): Promise<T[]> {
  const result: T[] = [];
  for (let index = 0; index < items.length; index++) if(await fn(items[index], index)) result.push(items[index]);
  return result;
}
export async function everyAsync<T>(items: readonly T[], fn: (item: T, index: number) => unknown): Promise<boolean> {
  for (let index = 0; index < items.length; index++) if(!await fn(items[index], index)) return false;
  return true;
}
export async function someAsync<T>(items: readonly T[], fn: (item: T, index: number) => unknown): Promise<boolean> {
  for (let index = 0; index < items.length; index++) if(await fn(items[index], index)) return true;
  return false;
}
export async function flatMapAsync<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R[]> | R[]): Promise<R[]> {
  return (await mapAsync(items, fn)).flat();
}
