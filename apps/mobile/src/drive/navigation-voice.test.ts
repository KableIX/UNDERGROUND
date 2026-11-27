import { describe, expect, it } from 'vitest';
import { britishVoices, claimCue, qualityLabel, spokenInstruction, voiceCue } from './navigation-voice';

const turn = { index: 5, instruction: 'Turn left onto Saratoga Avenue.' };
const voice = (id: string, name: string, language: string, quality?: string) => ({ identifier:id, name, language, quality });

describe('spoken navigation', () => {
  it('chooses the best installed British voice, including premium voices reported as default by Expo', () => {
    const choices = britishVoices([voice('compact.serena','Serena','en_GB'), voice('enhanced.daniel','Daniel','en-GB','Enhanced'),
      voice('us','English','en-US','Enhanced'), voice('premium.serena','Serena','en-GB','Default'), voice('eloquence.1','Eddy','en-GB')]);
    expect(choices.map(v=>v.identifier)).toEqual(['premium.serena','compact.serena']);
    expect(qualityLabel(choices[0])).toBe('Premium');
  });
  it('uses shorter lead distances around town and gives the motorway turn earlier', () => {
    expect(voiceCue('following',turn,300,'Drive',4)).toBeNull();
    expect(voiceCue('following',turn,400,'Drive',24)?.text).toBe('In a quarter mile, turn left onto Saratoga Avenue.');
    expect(voiceCue('following',turn,55,'Drive',22)?.key).toBe('5-now');
    expect(voiceCue('following',turn,55,'Drive',4)?.key).toBe('5-ahead');
    expect(voiceCue('following',turn,150,'Drive',null)?.key).toBe('5-ahead');
    expect(voiceCue('following',turn,19,'Drive',0)?.text).toBe(turn.instruction);
  });
  it('keeps storage format out of spoken directions and leaves street names intact', () => {
    expect(spokenInstruction('Turn left onto Saratoga-Los Gatos Rd./CA 9.')).toBe('Turn left onto Saratoga-Los Gatos Road, Highway 9.');
    expect(spokenInstruction('Take I-280 toward US 101.')).toBe('Take Interstate 280 toward US 101.');
  });
  it('announces a road continuation only once and leaves arrival to the actual finish', () => {
    expect(voiceCue('following',{index:9,instruction:'Continue on Main Street.'},20,'Drive')?.key).toBe('9-continue');
    for(const s of ['You have arrived at your destination.','Arrive at Main Street.','Finish at the garage.'])
      expect(voiceCue('following',{index:9,instruction:s},20,'Drive')).toBeNull();
    expect(voiceCue('off-route',turn,20,'Drive')?.key).toBe('off-route');
    expect(voiceCue('finished',turn,0,'Saratoga')?.text).toContain('Back in Saratoga');
  });
  it('does not restart a prompt after a GPS bounce or cut off a just-spoken advance cue', () => {
    const seen = new Set<string>();
    expect(claimCue(seen,null,'approach-4-ahead',1000)).toBe(true);
    expect(claimCue(seen,null,'approach-4-ahead',2000)).toBe(false);
    expect(claimCue(seen,{key:'approach-4-ahead',time:1000},'approach-4-now',4000)).toBe(false);
    expect(claimCue(seen,null,'5-now',6000)).toBe(true);
    expect(claimCue(seen,null,'5-ahead',7000)).toBe(false);
    expect(claimCue(seen,{key:'6-ahead',time:1000},'6-now',9000)).toBe(true);
  });
});
