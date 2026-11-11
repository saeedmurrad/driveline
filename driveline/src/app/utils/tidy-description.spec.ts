import { tidyDescription } from './tidy-description';

describe('tidyDescription', () => {
  it('turns shouted feed text into chips and sentence case, keeping abbreviations', () => {
    const r = tidyDescription(
      '**ULEZ COMPLIANT**DELIVERY & VIDEO CALL AVAILABLE**TOP SPEC WITH FULL SERVICE HISTORY + MOT TESTED AT 77K, USB/CAR-PLAY, HPI CHECKED, AUDI DEALER SERVICED',
      'Audi A6',
    );
    expect(r.highlights).toEqual(['ULEZ compliant', 'Delivery & video call available']);
    expect(r.text).toBe('Top spec with full service history + MOT tested at 77k, USB/CarPlay, HPI checked, Audi dealer serviced.');
  });

  it('leaves normal mixed-case text alone', () => {
    const r = tidyDescription('A lovely car. Full history and two keys.');
    expect(r.highlights).toEqual([]);
    expect(r.text).toBe('A lovely car. Full history and two keys.');
  });

  it('copes with an empty description', () => {
    expect(tidyDescription(undefined)).toEqual({ highlights: [], text: '' });
  });
});
