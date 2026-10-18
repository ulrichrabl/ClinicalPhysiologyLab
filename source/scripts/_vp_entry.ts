/** Bundle entry for the virtual-patient data-model tests. */
export * from '../src/vp/index.ts';
export { settleWithCirculation } from './_runtime_slice_entry.ts';
export { FREE_CASE } from '../src/vp/app/free-case.ts';
export { buildReport, issueUrl, stepsOf, reportFileName, REPORT_SCHEMA } from '../src/vp/app/report.ts';
export { cycle as phonoCycle } from '../src/vp/render/phono.ts';
