/** Finding → cause traceability for teaching (spec §6.3). */
export function explainFinding(finding: string, causes: string[]): { finding: string; causes: string[] } {
  return { finding, causes };
}
