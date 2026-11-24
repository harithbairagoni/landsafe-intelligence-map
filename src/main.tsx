import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ChevronDown, Compass, FileText, Landmark, MapPin, Search, ShieldCheck } from 'lucide-react';
import { ParcelMap } from './ParcelMap';
import { checks, emptyFinding, readSavedFindings, safeSource, saveFindings, statusOptions, type Finding, type Findings, type Parcel, type Status } from './model';
import fixtures from './fixtures.json';
import './styles.css';

const rows: Parcel[] = fixtures;

function Workspace() {
  const [parcels, setParcels] = useState(rows);
  const [selected, setSelected] = useState(rows[0]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [brief, setBrief] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/parcels', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async response => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
      .then(payload => {
        if (payload?.mode !== 'synthetic' || !Array.isArray(payload.parcels) || !payload.parcels.length) return;
        setParcels(payload.parcels);
        setSelected(previous => payload.parcels.find((p: Parcel) => p.id === previous.id) ?? payload.parcels[0]);
      }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const matches = parcels.filter(p => [p.survey, 'plot ' + p.plot, p.village, p.mandal, p.district].some(value => value.toLowerCase().includes(query.trim().toLowerCase())));
  const select = (parcel: Parcel) => { setSelected(parcel); setSearchOpen(false); setQuery(''); };

  return <>
    <header className="topbar">
      <a className="brand" href="/" aria-label="LandSafe home"><span className="brand-icon"><ShieldCheck size={23} strokeWidth={1.8} /></span><span>LandSafe <small>Intelligence Map</small></span></a>
      <div className="header-right"><span className="region"><MapPin size={15} /> Telangana</span><span className="demo-pill"><i /> Demo data</span></div>
    </header>
    <main className="workspace">
      <div className="workspace-title"><div><div className="crumb"><Compass size={15} /> Parcel research</div><h1>Parcel workspace</h1></div>
        <form className="search" role="search" onSubmit={event => { event.preventDefault(); if (matches.length === 1) select(matches[0]); else setSearchOpen(true); }}>
          <Search size={19} /><input aria-label="Find a survey or plot" placeholder="Search survey, plot, or village" value={query}
            onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }}
            onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} />
          {searchOpen && <div className="search-results" aria-label="Matching parcels">
            {matches.map(parcel => <button type="button" key={parcel.id} onClick={() => select(parcel)}><strong>Survey {parcel.survey}</strong><span>Plot {parcel.plot} · {parcel.mandal}</span></button>)}
            {!matches.length && <p>No matching demonstration parcels.</p>}
            <button type="button" className="dismiss" onClick={() => setSearchOpen(false)}>Close results</button>
          </div>}
        </form>
      </div>
      <div className="demo-note"><Landmark size={17} /><span>Training workspace. Parcel boundaries and findings are synthetic. Use sample information only.</span></div>
      <div className="workspace-grid">
        <ParcelMap parcels={parcels} selected={selected} onSelect={select} />
        <ParcelCase key={selected.id} parcel={selected} brief={brief} setBrief={setBrief} />
      </div>
    </main>
  </>;
}

function ParcelCase({ parcel, brief, setBrief }: { parcel: Parcel; brief: boolean; setBrief: (value: boolean) => void }) {
  const [findings, setFindings] = useState<Findings>(() => readSavedFindings(parcel));
  const [open, setOpen] = useState<string | null>('ftl');
  const [saved, setSaved] = useState('');
  const reviewed = checks.filter(([id]) => findings[id]?.status && findings[id].status !== 'Pending').length;

  function update(id: string, finding: Finding) {
    const updated = { ...findings, [id]: finding };
    setFindings(updated);
    setSaved(saveFindings(parcel, updated) ? 'Saved on this browser' : 'Browser storage unavailable');
  }

  return <section className="case-panel" aria-label="Parcel case">
    <div className="case-summary">
      <div className="case-id"><span>Parcel case</span><span>{parcel.id.toUpperCase()}</span></div>
      <h2>Survey {parcel.survey}</h2>
      <p><MapPin size={16} /> {parcel.mandal}, {parcel.district}</p>
      <dl className="parcel-facts"><div><dt>Plot</dt><dd>{parcel.plot}</dd></div><div><dt>Sample area</dt><dd>{parcel.area}</dd></div><div><dt>Checks entered</dt><dd>{reviewed} / {checks.length}</dd></div></dl>
    </div>
    <div className="case-heading">
      <div className="tabs" role="group" aria-label="Case view"><button aria-pressed={!brief} onClick={() => setBrief(false)}>Evidence</button><button aria-pressed={brief} onClick={() => setBrief(true)}>Customer brief</button></div>
      {brief ? <button className="round-action" title="Print brief" aria-label="Print brief" onClick={() => print()}><FileText size={18} /></button> : <span className="save-status" aria-live="polite">{saved}</span>}
    </div>
    {brief ? <div className="brief-view">
      <p className="brief-note">Demonstration brief for Survey {parcel.survey}. Entries below refer to sample data.</p>
      {checks.map(([id, title]) => { const finding = findings[id] ?? emptyFinding; const source = safeSource(finding.source);
        return <div className="brief-row" key={id}><strong>{title}</strong><StatusLabel status={finding.status} /><p>{finding.notes || 'Awaiting evidence review.'}</p>{source && <a href={source} target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} /></a>}</div>;
      })}
      <button className="primary print-button" onClick={() => print()}><FileText size={17} /> Print customer brief</button>
    </div> : <div className="evidence-list">{checks.map(([id, title]) => <div key={id} className="evidence-item">
      <button className="evidence-toggle" type="button" aria-expanded={open === id} aria-controls={'finding-' + id} onClick={() => setOpen(open === id ? null : id)}>
        <span>{title}</span><StatusLabel status={findings[id]?.status ?? 'Pending'} /><ChevronDown size={16} className={open === id ? 'expanded' : ''} />
      </button>
      {open === id && <EvidenceEditor id={id} finding={findings[id] ?? emptyFinding} onSave={finding => update(id, finding)} />}
    </div>)}</div>}
  </section>;
}

function StatusLabel({ status }: { status: Status }) {
  return <span className={'status ' + status.toLowerCase().split(' ')[0]}>{status}</span>;
}

function EvidenceEditor({ id, finding, onSave }: { id: string; finding: Finding; onSave: (value: Finding) => void }) {
  const [draft, setDraft] = useState(finding);
  const savedUrl = safeSource(finding.source);
  const invalid = Boolean(draft.source && !safeSource(draft.source));
  return <form id={'finding-' + id} className="evidence-editor" onSubmit={event => { event.preventDefault(); if (!invalid) onSave(draft); }}>
    <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Status })}>
      {statusOptions.map(status => <option key={status}>{status}</option>)}
    </select></label>
    <label>Finding<textarea rows={3} maxLength={2500} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="Record the finding or the check still required" /></label>
    <label>Source URL<input type="url" maxLength={1500} value={draft.source} aria-invalid={invalid} onChange={event => setDraft({ ...draft, source: event.target.value })} placeholder="https://…" /></label>
    {invalid && <small>Use an HTTP or HTTPS source URL.</small>}
    <div className="editor-actions"><button className="primary" type="submit" disabled={invalid}>Save finding</button>{savedUrl && <a href={savedUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={15} /></a>}</div>
  </form>;
}

createRoot(document.getElementById('root')!).render(<Workspace />);
