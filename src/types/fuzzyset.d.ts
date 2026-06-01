declare module "fuzzyset" {
  export default class FuzzySet {
    constructor(arr?: string[]);
    get(
      value: string,
      defaultValue?: null,
      minScore?: number
    ): [number, string][] | null;
    add(value: string): boolean;
    length(): number;
    isEmpty(): boolean;
    values(): string[];
  }
}
