import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Section } from '@/primitives';

describe('Section', () => {
  it('renders children when data is non-empty array', () => {
    render(
      <Section id="skills" title="Skills" data={['Python', 'TypeScript']}>
        <p>Content here</p>
      </Section>
    );
    expect(screen.getByText('Skills')).toBeDefined();
    expect(screen.getByText('Content here')).toBeDefined();
  });

  it('renders nothing when data is empty array', () => {
    const { container } = render(
      <Section id="skills" title="Skills" data={[]}>
        <p>Content here</p>
      </Section>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is null', () => {
    const { container } = render(
      <Section id="skills" title="Skills" data={null}>
        <p>Content here</p>
      </Section>
    );
    expect(container.innerHTML).toBe('');
  });

  it('applies className and containerClassName', () => {
    const { container } = render(
      <Section id="skills" title="Skills" data={['item']} className="bg-black" containerClassName="max-w-6xl">
        <p>Content</p>
      </Section>
    );
    const section = container.querySelector('section');
    expect(section?.className).toContain('bg-black');
    const div = section?.querySelector('div');
    expect(div?.className).toContain('max-w-6xl');
  });

  it('sets anchor id for navigation', () => {
    const { container } = render(
      <Section id="experience" title="Experience" data={['item']}>
        <p>Content</p>
      </Section>
    );
    const section = container.querySelector('section');
    expect(section?.id).toBe('experience');
  });
});
