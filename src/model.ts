export const checks = [
  ['survey', 'Survey record'], ['plot', 'Plot and layout'], ['hydraa', 'HYDRAA jurisdiction'],
  ['ftl', 'Full Tank Level'], ['buffer', 'Lake buffer'], ['restrictions', 'Registration and zoning'],
  ['government', 'Government land'], ['defence', 'Defence land'], ['ec', 'Encumbrance certificate'],
  ['owner', 'Recorded ownership'], ['litigation', 'Litigation and orders'], ['other', 'Access, approvals and acquisition'],
] as const;

export const statusOptions = ['Pending', 'Verified', 'Possible match', 'Unavailable', 'No match in sources checked'] as const;
export type Status = typeof statusOptions[number];
export type Finding = { status: Status; notes: string; source: string };
export type Findings = Record<string, Finding>;
export type Parcel = {
  id: string; survey: string; plot: string; village: string; mandal: string;
  district: string; area: string; bbox: number[]; example: string;
};

export const emptyFinding: Finding = { status: 'Pending', notes: '', source: '' };
const hmda = 'https://lakes.hmda.gov.in/';
export const defaultFindings = (parcel: Parcel): Findings => ({
  survey: { status: 'Verified', notes: 'Synthetic survey identifier and parcel boundary for this training case.', source: '' },
  plot: { status: 'Possible match', notes: 'Synthetic layout reference. Confirm against the sanctioned plan during a real review.', source: '' },
  ftl: parcel.example === 'overlap'
    ? { status: 'Verified', notes: 'The synthetic parcel intersects the synthetic FTL overlay. The linked lake register is a separate reference.', source: hmda }
    : parcel.example === 'document'
      ? { status: 'Possible match', notes: 'Sample notice reference. Affected extent has not been established.', source: hmda }
      : { status: 'Unavailable', notes: 'Lake coverage for this example is unavailable.', source: '' },
  buffer: { status: parcel.example === 'overlap' ? 'Possible match' : 'Unavailable', notes: 'Illustrative layer. Confirm the applicable boundary and notification for real cases.', source: hmda },
  defence: { status: 'Unavailable', notes: 'No cleared dataset is attached to this sample.', source: '' },
});

export function readSavedFindings(parcel: Parcel): Findings {
  try {
    const stored = JSON.parse(localStorage.getItem('landsafe:findings:v1:' + parcel.id) ?? '{}') as Findings;
    const valid = Object.fromEntries(checks.flatMap(([key]) => {
      const finding = stored?.[key];
      return finding && statusOptions.includes(finding.status) &&
        typeof finding.notes === 'string' && typeof finding.source === 'string' ? [[key, finding]] : [];
    }));
    return { ...defaultFindings(parcel), ...valid };
  } catch {
    return defaultFindings(parcel);
  }
}

export function saveFindings(parcel: Parcel, findings: Findings) {
  try {
    localStorage.setItem('landsafe:findings:v1:' + parcel.id, JSON.stringify(findings));
    return true;
  } catch {
    return false;
  }
}

export function safeSource(text: string) {
  try {
    const url = new URL(text);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
