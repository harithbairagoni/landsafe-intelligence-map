import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ChevronDown, FileText, Layers3, Link2, MapPin, Search, ShieldCheck } from 'lucide-react';
import { ParcelMap } from './ParcelMap';
import { checks, emptyFinding, readSavedFindings, safeSource, saveFindings, statusOptions, type Finding, type Findings, type Parcel, type Status } from './model';
import fixtures from './fixtures.json';
import { initialParcelId, parcelAtPoint, parseCoordinate, searchParcels, type Coordinate } from './spatial';
import './styles.css';

const rows: Parcel[] = fixtures;

function Workspace() {
  const [parcels, setParcels] = useState(rows);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialParcelId(window.location.href, rows));
  const [pin, setPin] = useState<Coordinate | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [brief, setBrief] = useState(false);
  const [copied, setCopied] = useState('');
  const selected = parcels.find(parcel => parcel.id === selectedId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/parcels', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async response => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
      .then(payload => {
        if (payload?.mode !== 'synthetic' || !Array.isArray(payload.parcels) || !payload.parcels.length) return;
        setParcels(payload.parcels);
      }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const point = parseCoordinate(query);
  const matches = point ? parcelAtPoint(parcels, point) : searchParcels(parcels, query);

  function setParcelUrl(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('parcel', id);
    else url.searchParams.delete('parcel');
    history.replaceState(history.state, '', url);
  }

  function select(id: string) {
    setSelectedId(id);
    setPin(null);
    setSearchOpen(false);
    setQuery('');
    setCopied('');
    setParcelUrl(id);
  }

  function inspectUncovered(point: Coordinate) {
    setSelectedId(null);
    setPin(point);
    setSearchOpen(false);
    setCopied('');
    setParcelUrl(null);
  }

  async function copyParcelLink() {
    try {
      setParcelUrl(selectedId);
      await navigator.clipboard.writeText(window.location.href);
      setCopied('Link copied');
    } catch {
      setCopied('Copy the link from your address bar');
    }
  }

  return <>
    <header className="topbar">
      <a className="brand" href="/" aria-label="LandSafe home"><span className="brand-icon"><ShieldCheck size={23} strokeWidth={1.8} /></span><span>LandSafe <small>Intelligence Map</small></span></a>
      <div className="header-right"><span className="region"><MapPin size={15} /> Telangana pilot</span><span className="demo-pill"><i /> Synthetic data</span></div>
    </header>
    <main className="workspace spatial-workspace">
      <div className="workspace-title">
        <div><div className="crumb"><Layers3 size={15} /> Land intelligence</div><h1>Survey explorer</h1></div>
        <form className="search" role="search" onSubmit={event => {
          event.preventDefault();
          if (matches.length === 1) select(matches[0].id);
          else if (point && matches.length === 0) inspectUncovered(point);
          else setSearchOpen(true);
        }}>
          <Search size={19} /><input aria-label="Find a survey, plot, village, or coordinates" placeholder="Survey, plot, village or lat, lng" value={query}
            onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }}
            onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} />
          {searchOpen && <div className="search-results" aria-label="Matching parcels">
            {matches.map(parcel => <button type="button" key={parcel.id} onClick={() => select(parcel.id)}>
              <strong>Survey {parcel.survey}</strong><span>Plot {parcel.plot} · {parcel.mandal}</span>
            </button>)}
            {!matches.length && (point ? <button type="button" onClick={() => inspectUncovered(point)}>Inspect coordinates</button> : <p>No matching sample parcels.</p>)}
            <button type="button" className="dismiss" onClick={() => setSearchOpen(false)}>Close results</button>
          </div>}
        </form>
      </div>
      <div className="workspace-grid">
        <ParcelMap parcels={parcels} selected={selected} pin={pin} onSelect={select} onUncovered={inspectUncovered} />
        {selected ? <ParcelCase key={selected.id} parcel={selected} brief={brief} setBrief={setBrief} share={() => void copyParcelLink()} shareStatus={copied} /> :
          <section className="case-panel empty-inspector" aria-label="Parcel coverage"><MapPin size={30} />
            <h2>{pin ? 'No mapped survey here' : 'Select a survey'}</h2>
            {pin && <p className="coordinates">{pin[1].toFixed(5)}, {pin[0].toFixed(5)}</p>}
            <p>Coverage here is unavailable in this pilot. Select a labeled boundary or search for a sample survey.</p>
            <button className="primary" onClick={() => parcels[0] && select(parcels[0].id)}>Return to sample parcel</button>
          </section>}
      </div>
    </main>
  </>;
}

const groups = [
  { title: 'Parcel identity', ids: ['survey', 'plot'] },
  { title: 'Planning and land status', ids: ['hydraa', 'ftl', 'buffer', 'restrictions', 'zoning', 'government', 'defence', 'other'] },
  { title: 'Ownership and legal records', ids: ['owner', 'ec', 'litigation'] },
];

function ParcelCase({ parcel, brief, setBrief, share, shareStatus }: {
  parcel: Parcel; brief: boolean; setBrief: (value: boolean) => void; share: () => void; shareStatus: string;
}) {
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
      <div className="case-id"><span>Survey details</span><button className="case-link" onClick={share} title="Copy survey link" aria-label="Copy survey link"><Link2 size={16} /></button></div>
      <h2>Survey {parcel.survey}</h2>
      <p><MapPin size={16} /> {parcel.village}, {parcel.mandal}, {parcel.district}</p>
      <span className="sr-only" aria-live="polite">{shareStatus}</span>
      <dl className="parcel-facts"><div><dt>Plot</dt><dd>{parcel.plot}</dd></div><div><dt>Sample area</dt><dd>{parcel.area}</dd></div><div><dt>Checks entered</dt><dd>{reviewed} / {checks.length}</dd></div></dl>
    </div>
    <div className="case-heading">
      <div className="tabs" role="group" aria-label="Case view"><button aria-pressed={!brief} onClick={() => setBrief(false)}>Evidence</button><button aria-pressed={brief} onClick={() => setBrief(true)}>Customer brief</button></div>
      {brief ? <button className="round-action" title="Print brief" aria-label="Print brief" onClick={() => print()}><FileText size={18} /></button> : <span className="save-status" aria-live="polite">{shareStatus || saved}</span>}
    </div>
    {brief ? <div className="brief-view">
      <p className="brief-note">Demonstration brief for Survey {parcel.survey}. Entries below refer to sample data.</p>
      {checks.map(([id, title]) => { const finding = findings[id] ?? emptyFinding; const source = safeSource(finding.source);
        return <div className="brief-row" key={id}><strong>{title}</strong><StatusLabel status={finding.status} /><p>{finding.notes || 'Awaiting evidence review.'}</p>{finding.asOf && <small>Evidence date {finding.asOf}</small>}{source && <a href={source} target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} /></a>}</div>;
      })}
      <button className="primary print-button" onClick={() => print()}><FileText size={17} /> Print customer brief</button>
    </div> : <div className="evidence-list">{groups.map(group => <section className="evidence-group" key={group.title}>
      <h3>{group.title}</h3>
      {checks.filter(([id]) => group.ids.includes(id)).map(([id, title]) => <div key={id} className="evidence-item">
      <button className="evidence-toggle" type="button" aria-expanded={open === id} aria-controls={'finding-' + id} onClick={() => setOpen(open === id ? null : id)}>
        <span>{title}</span><StatusLabel status={findings[id]?.status ?? 'Pending'} /><ChevronDown size={16} className={open === id ? 'expanded' : ''} />
      </button>
      {open === id && <EvidenceEditor id={id} finding={findings[id] ?? emptyFinding} onSave={finding => update(id, finding)} />}
      </div>)}
    </section>)}</div>}
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
    <label>Evidence date<input type="date" value={draft.asOf ?? ''} onChange={event => setDraft({ ...draft, asOf: event.target.value })} /></label>
    <label>Source URL<input type="url" maxLength={1500} value={draft.source} aria-invalid={invalid} onChange={event => setDraft({ ...draft, source: event.target.value })} placeholder="https://…" /></label>
    {invalid && <small>Use an HTTP or HTTPS source URL.</small>}
    <div className="editor-actions"><button className="primary" type="submit" disabled={invalid}>Save finding</button>{savedUrl && <a href={savedUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={15} /></a>}</div>
  </form>;
}

createRoot(document.getElementById('root')!).render(<Workspace />);
