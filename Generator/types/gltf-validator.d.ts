// Minimal declarations for the parts of gltf-validator the generator uses.
declare module 'gltf-validator' {
  export interface ValidationReport {
    readonly issues: {
      readonly numErrors: number;
      readonly numWarnings: number;
      readonly numInfos: number;
      readonly messages: readonly {
        readonly code: string;
        readonly message: string;
        /** 0 error, 1 warning, 2 information, 3 hint. */
        readonly severity: number;
        readonly pointer?: string;
      }[];
    };
  }
  export interface ValidationOptions {
    readonly uri?: string;
    readonly externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
  }
  const validator: {
    validateBytes(data: Uint8Array, options?: ValidationOptions): Promise<ValidationReport>;
    version(): string;
  };
  export default validator;
}
