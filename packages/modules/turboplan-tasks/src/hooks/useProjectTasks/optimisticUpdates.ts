/**
 * Optimistic Update Pattern Utility
 * Provides a reusable pattern for optimistic UI updates with automatic rollback
 */

/**
 * Executes an operation with optimistic UI updates and automatic rollback on error.
 * This pattern provides immediate feedback to users while the API request is in flight.
 *
 * @param optimisticUpdate - Function to apply immediate UI update
 * @param apiOperation - Async API call to perform the actual operation
 * @param revertUpdate - Function to revert UI changes if API call fails
 * @param onError - Error handler callback
 * @param operationName - Name of the operation for error messages
 * @returns The API operation result or throws on error
 *
 * @example
 * await executeOptimistic(
 *   () => addTask(milestoneId, tempTask),
 *   () => apiService.createTask(taskData),
 *   () => removeTask(tempTask.id),
 *   handleError,
 *   "createTask"
 * );
 */
export async function executeOptimistic<T>(
  optimisticUpdate: () => void,
  apiOperation: () => Promise<T>,
  revertUpdate: () => void,
  onError: (error: unknown, operation: string) => void,
  operationName: string,
): Promise<T> {
  try {
    // Apply optimistic update immediately
    optimisticUpdate();

    // Execute API operation
    const result = await apiOperation();

    // Success - optimistic update was correct
    return result;
  } catch (error) {
    // Revert optimistic update on error
    revertUpdate();
    onError(error, operationName);
    throw error;
  }
}

/**
 * Creates a bound version of executeOptimistic with a specific error handler
 * @param onError - Error handler to use for all operations
 * @returns Bound executeOptimistic function
 */
export function createOptimisticExecutor(
  onError: (error: unknown, operation: string) => void,
) {
  return <T>(
    optimisticUpdate: () => void,
    apiOperation: () => Promise<T>,
    revertUpdate: () => void,
    operationName: string,
  ): Promise<T> => {
    return executeOptimistic(
      optimisticUpdate,
      apiOperation,
      revertUpdate,
      onError,
      operationName,
    );
  };
}
