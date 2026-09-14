/** Creates a descriptive error for when a feature package fails to load. */
export const featurePackageError = (
  featureName: string,
  packageName: string,
  error: unknown,
): Error => {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `${featureName} feature is enabled but ${packageName} is not available. ` +
      `Either disable the feature or install the package. Original error: ${message}`,
  );
};
