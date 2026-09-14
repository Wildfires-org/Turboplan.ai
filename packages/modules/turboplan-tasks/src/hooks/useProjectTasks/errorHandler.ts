/**
 * Error Handler for Task Operations
 * Centralized error handling logic with typed error classification
 */

import {
  AuthenticationError,
  NetworkError,
  TaskServiceError,
  ValidationError,
} from "../../types/service";

/**
 * Handles service errors and converts them to user-friendly messages
 * @param error - The error object from the service layer
 * @param operation - Name of the operation that failed
 * @returns User-friendly error message
 */
export function createErrorMessage(error: unknown, operation: string): string {
  if (error instanceof ValidationError) {
    return `Invalid data: ${error.message}`;
  }

  if (error instanceof NetworkError) {
    return `Network error: ${error.message}`;
  }

  if (error instanceof AuthenticationError) {
    return `Authentication required: ${error.message}`;
  }

  if (error instanceof TaskServiceError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `${operation} failed`;
}

/**
 * Creates an error handler function bound to a setError callback
 * @param setError - Function to set error state
 * @returns Error handler function
 */
export function createErrorHandler(setError: (error: string) => void) {
  return (error: unknown, operation: string) => {
    const errorMessage = createErrorMessage(error, operation);
    setError(errorMessage);
  };
}
