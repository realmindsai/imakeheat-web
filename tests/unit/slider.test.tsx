import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Slider } from '../../src/components/Slider'

describe('Slider', () => {
  it('renders the thumb at the value position', () => {
    const { container } = render(<Slider value={0.25} />)
    const thumb = container.querySelector('[data-thumb]') as HTMLElement
    expect(thumb.style.left).toBe('25%')
  })

  it('clamps value into [0, 1]', () => {
    const { container } = render(<Slider value={2} />)
    const thumb = container.querySelector('[data-thumb]') as HTMLElement
    expect(thumb.style.left).toBe('100%')
  })

  it('shows a center tick when neutralCenter is set', () => {
    const { container } = render(<Slider value={0.5} neutralCenter />)
    expect(container.querySelector('[data-center-tick]')).not.toBeNull()
  })

  it('does not show a center tick by default', () => {
    const { container } = render(<Slider value={0.5} />)
    expect(container.querySelector('[data-center-tick]')).toBeNull()
  })
})
