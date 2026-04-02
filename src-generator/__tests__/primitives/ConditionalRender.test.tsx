import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConditionalRender } from '@/primitives';

describe('ConditionalRender', () => {
  it('renders children when data is truthy', () => {
    const { container } = render(
      <ConditionalRender data="hello">
        <p>visible</p>
      </ConditionalRender>
    );
    expect(container.textContent).toBe('visible');
  });

  it('renders nothing when data is null', () => {
    const { container } = render(
      <ConditionalRender data={null}>
        <p>hidden</p>
      </ConditionalRender>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is undefined', () => {
    const { container } = render(
      <ConditionalRender data={undefined}>
        <p>hidden</p>
      </ConditionalRender>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is empty string', () => {
    const { container } = render(
      <ConditionalRender data="">
        <p>hidden</p>
      </ConditionalRender>
    );
    expect(container.innerHTML).toBe('');
  });
});
