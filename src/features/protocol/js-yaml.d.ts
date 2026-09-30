declare module 'js-yaml' {
  export const CORE_SCHEMA: object;
  export function load(input: string, options?: {
    schema?: object; json?: boolean; maxDepth?: number; maxTotalMergeKeys?: number;
    onWarning?: (error: unknown) => void;
    listener?: (event: string, state: { anchor: string | null }) => void;
  }): unknown;
}
