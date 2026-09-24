import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './AdminFilterControls.css';

function useOutside(ref, close) {
  useEffect(() => {
    const handle = e => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [ref, close]);
}

export function AdminSelect({ value, onChange, options, label, width = 180 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const selected = options.find(o => String(o.value) === String(value)) || options[0];
  const choose = option => { onChange(option.value); setOpen(false); };
  return <div className={'np-choice' + (open ? ' is-open' : '')} ref={ref} style={{ minWidth: width }}>
    <button type="button" className="np-choice-trigger" aria-label={label || selected?.label} aria-haspopup="listbox" aria-expanded={open}
      onClick={() => setOpen(v => !v)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
      <span>{selected?.label}</span><ChevronDown size={17} className="np-choice-chevron" />
    </button>
    {open && <div className="np-choice-menu" role="listbox" aria-label={label || 'Filter options'}>
      {options.map((o, i) => <button type="button" role="option" aria-selected={String(value) === String(o.value)}
        key={String(o.value) + i} className={'np-choice-option' + (String(value) === String(o.value) ? ' selected' : '')}
        onClick={() => choose(o)}>{o.label}{String(value) === String(o.value) && <Check size={15}/>}</button>)}
    </div>}
  </div>;
}

const weekdays = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const pad = n => String(n).padStart(2,'0');
const toISO = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`;
export function AdminDatePicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const initial = value ? new Date(value + 'T12:00:00') : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const year = month.getFullYear(), m = month.getMonth();
  const offset = (new Date(year,m,1).getDay()+6)%7;
  const days = new Date(year,m+1,0).getDate();
  const selectedDate = value ? new Date(value+'T12:00:00').toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}) : 'Choose date';
  const changeMonth = diff => setMonth(old => new Date(old.getFullYear(),old.getMonth()+diff,1));
  return <div className={'np-date' + (open ? ' is-open' : '')} ref={ref}>
    <span className="np-date-label">{label}</span>
    <button type="button" className="np-date-trigger" onClick={() => { if (!open && value) setMonth(new Date(initial.getFullYear(),initial.getMonth(),1)); setOpen(!open); }} aria-expanded={open} aria-label={label}>
      <CalendarDays size={16}/><span className={value ? '' : 'np-date-placeholder'}>{selectedDate}</span><ChevronDown size={15}/>
    </button>
    {open && <div className="np-calendar" role="dialog" aria-label={label + ' calendar'} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}>
      <div className="np-calendar-head"><button type="button" aria-label="Previous month" onClick={()=>changeMonth(-1)}><ChevronLeft size={17}/></button>
        <strong>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong>
        <button type="button" aria-label="Next month" onClick={()=>changeMonth(1)}><ChevronRight size={17}/></button></div>
      <div className="np-calendar-grid">{weekdays.map(d=><span className="np-calendar-weekday" key={d}>{d}</span>)}
        {Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
        {Array.from({length:days},(_,i)=>{const date=toISO(year,m,i+1);return <button type="button" key={date} aria-label={date} aria-pressed={value===date} className={value===date?'active':''} onClick={()=>{onChange(date);setOpen(false)}}>{i+1}</button>})}</div>
      <div className="np-calendar-footer"><button type="button" onClick={()=>{onChange('');setOpen(false)}}><X size={14}/> Clear</button><button type="button" onClick={()=>{onChange(toISO(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()));setOpen(false)}}>Today</button></div>
    </div>}
  </div>;
}
