export class ApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export class DataFormatError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = 'DataFormatError';
    this.details = details;
  }
}

export function isDataFormatError(error: unknown): error is DataFormatError {
  return error instanceof DataFormatError;
}
