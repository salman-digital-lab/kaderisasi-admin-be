export function matchesCertificateTemplateVersion(
  currentVersion: number,
  expectedVersion: number
): boolean {
  return currentVersion === expectedVersion
}

export function nextCertificateTemplateVersion(currentVersion: number): number {
  return currentVersion + 1
}
