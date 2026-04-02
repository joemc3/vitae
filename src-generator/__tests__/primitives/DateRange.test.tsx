import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DateRange } from '@/primitives';

describe('DateRange', () => {
  it('formats a full date range', () => {
    const { container } = render(<DateRange startDate="2020-01" endDate="2024-06" />);
    expect(container.textContent).toBe('Jan 2020 \u2013 Jun 2024');
  });

  it('shows Present for current roles', () => {
    const { container } = render(<DateRange startDate="2020-01" endDate="Present" />);
    expect(container.textContent).toBe('Jan 2020 \u2013 Present');
  });

  it('shows only end date when start is missing', () => {
    const { container } = render(<DateRange endDate="2018-05" />);
    expect(container.textContent).toBe('2018');
  });

  it('shows year-only for year-only input', () => {
    const { container } = render(<DateRange startDate="2020" endDate="2024" />);
    expect(container.textContent).toBe('2020 \u2013 2024');
  });

  it('renders nothing when both dates are missing', () => {
    const { container } = render(<DateRange />);
    expect(container.innerHTML).toBe('');
  });
});
