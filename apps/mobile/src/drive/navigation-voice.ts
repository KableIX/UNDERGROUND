import type { Progress } from './route-navigation';

export type Voice = { identifier: string; language: string; name: string; quality?: string };

export function qualityLabel(v: Voice) {
  const info = [v.identifier, v.name, v.quality].join(' ');
  if (/premium/i.test(info)) return 'Premium';
  if (/enhanced|\.premium-high/i.test(info)) return 'Enhanced';
  return 'Standard';
}

export function britishVoices(voices: Voice[]) {
  const options = voices.filter(v => /^en[-_]gb(?:[-_]|$)/i.test(v.language) && /\b(serena|kate|martha)\b/i.test(v.name+' '+v.identifier) && !/eloquence|novelty/i.test(v.identifier));
  function score(v: Voice) {
    const quality = { Standard: 0, Enhanced: 1, Premium: 2 }[qualityLabel(v)];
    const natural = /eloquence|novelty/i.test(v.identifier) ? 0 : 10;
    const preferred = /\b(serena|kate|martha)\b/i.test(v.name + ' ' + v.identifier);
    return natural + quality * 2 + Number(preferred);
  }
  return options.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name) || a.identifier.localeCompare(b.identifier));
}

export type VoiceCue = { key: string; text: string; priority?: 'advisory' };
type Turn = { index: number; instruction: string };

export function spokenInstruction(raw: string) {
  return raw.trim()
    .replace(/\s*\/\s*(?:CA|SR)[ -]?(\d+)\b/gi, ', Highway $1')
    .replace(/\b(?:CA|SR)[ -]?(\d+)\b/gi, 'Highway $1')
    .replace(/\bI[- ](\d+)\b/g, 'Interstate $1')
    .replace(/\bU\.?S\.?[- ](\d+)\b/g, 'US $1')
    .replace(/\s*\/\s*/g, ', ')
    .replace(/\b(Blvd|Ave|Rd|Pkwy|Expy)\b\.?/gi, word => ({
      blvd: 'Boulevard', ave: 'Avenue', rd: 'Road', pkwy: 'Parkway', expy: 'Expressway',
    })[word.toLowerCase().replace('.', '')] ?? word);
}

export function voiceCue(phase: Progress['phase'], next: Turn | undefined, meters: number, title: string, speedMps?: number | null): VoiceCue | null {
  if (phase === 'finished') return { key: 'finish', text: title === 'Saratoga' ? 'Back in Saratoga. That was the long way round.' : 'Drive complete.' };
  if (phase === 'off-route') return { key: 'off-route', text: 'Off route. Rejoin the highlighted road when you can.' };
  if (phase !== 'following' || !next || !Number.isFinite(meters) || meters <= 0) return null;
  const instruction = spokenInstruction(next.instruction);
  if (!instruction || /^(?:you (?:have |will )?arrive|arriv(?:e|ed|al)\b|finish at\b|your destination\b)/i.test(instruction)) return null;
  const speed = speedMps != null && Number.isFinite(speedMps) && speedMps >= 0 ? speedMps : 12;
  const advance = Math.max(95, Math.min(405, speed * 18));
  const imminent = Math.max(20, Math.min(72, speed * 3.5));
  if (meters > advance) return null;
  // A road-name continuation gets one call. Save the second call for a real manoeuvre.
  if (/^(?:continue|stay) (?:straight |on )/i.test(instruction)) {
    return { key: next.index + '-continue', text: instruction };
  }
  if (meters <= imminent) return { key: next.index + '-now', text: instruction };
  const feet = Math.round(meters * 3.28084 / 50) * 50;
  const distance = meters >= 350 ? 'a quarter mile' : feet + ' feet';
  return { key: next.index + '-ahead', text: 'In ' + distance + ', ' + instruction[0].toLowerCase() + instruction.slice(1) };
}

// A fix or speed change can move a turn across both thresholds several times.
export function claimCue(seen: Set<string>, last: { key: string; time: number } | null, key: string, now: number) {
  if (seen.has(key)) return false;
  seen.add(key);
  if (key.endsWith('-ahead') && seen.has(key.replace(/-ahead$/, '-now'))) return false;
  return !(key.endsWith('-now') && last?.key === key.replace(/-now$/, '-ahead') && now - last.time < 5500);
}

// Lower-priority official weather messages are route-wide, never distance-to-hazard claims.
export function weatherVoiceCue(alert:{id:string;title:string}|undefined, context:{started:boolean;reliable:boolean;following:boolean;toTurn:number;speedMps?:number|null;hasTurn:boolean}):VoiceCue|null {
 if(!alert||!context.started||!context.reliable||!context.following)return null;
 const speed=typeof context.speedMps==='number'&&Number.isFinite(context.speedMps)?Math.max(0,context.speedMps):15;
 if(context.hasTurn&&(!Number.isFinite(context.toTurn)||context.toTurn<Math.max(600,speed*35)))return null;
 return {key:'intel-weather:'+alert.id,text:'Official weather advisory for this route. '+alert.title+'. Follow official guidance.',priority:'advisory'};
}

export function advisoryCanPlay(last:{key:string;time:number}|null, now:number){
 return last===null||now-last.time>=20000;
}
