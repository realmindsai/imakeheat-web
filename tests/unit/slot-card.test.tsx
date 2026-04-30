import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SlotCard } from '../../src/components/SlotCard'

function wrap(ui: React.ReactElement, ids: string[]) {
  return (
    <DndContext>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ui}
      </SortableContext>
    </DndContext>
  )
}

describe('SlotCard', () => {
  it('renders title, value label, and child panel when expanded', () => {
    const { getByText, getByRole } = render(
      wrap(
        <SlotCard
          id="a"
          title="Crusher"
          valueLabel="16-bit"
          position={1}
          total={3}
          enabled
          defaultExpanded
          onToggleEnabled={() => {}}
          onRemove={() => {}}
        >
          <div>panel-body</div>
        </SlotCard>,
        ['a'],
      ),
    )
    expect(getByText('Crusher')).toBeTruthy()
    expect(getByText('16-bit')).toBeTruthy()
    expect(getByText('panel-body')).toBeTruthy()
    expect(getByRole('group').getAttribute('aria-label')).toBe('Crusher, position 1 of 3')
  })

  it('hides children when defaultExpanded is false, and reveals on caret click', () => {
    const { queryByText, getByLabelText, getByText } = render(
      wrap(
        <SlotCard
          id="b"
          title="Echo"
          valueLabel="mix 0.30"
          position={2}
          total={4}
          enabled
          defaultExpanded={false}
          onToggleEnabled={() => {}}
          onRemove={() => {}}
        >
          <div>echo-body</div>
        </SlotCard>,
        ['b'],
      ),
    )
    expect(queryByText('echo-body')).toBeNull()
    fireEvent.click(getByLabelText('Expand Echo'))
    expect(getByText('echo-body')).toBeTruthy()
  })

  it('toggle button reflects enabled state and fires onToggleEnabled', () => {
    const onToggle = vi.fn()
    const { getByLabelText } = render(
      wrap(
        <SlotCard
          id="c"
          title="Filter"
          valueLabel="neutral"
          position={1}
          total={1}
          enabled
          defaultExpanded
          onToggleEnabled={onToggle}
          onRemove={() => {}}
        >
          <div />
        </SlotCard>,
        ['c'],
      ),
    )
    const btn = getByLabelText('Disable Filter')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('disabled state inverts the aria-label and aria-pressed', () => {
    const { getByLabelText } = render(
      wrap(
        <SlotCard
          id="d"
          title="Filter"
          valueLabel="neutral"
          position={1}
          total={1}
          enabled={false}
          defaultExpanded
          onToggleEnabled={() => {}}
          onRemove={() => {}}
        >
          <div />
        </SlotCard>,
        ['d'],
      ),
    )
    const btn = getByLabelText('Enable Filter')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('remove button fires onRemove', () => {
    const onRemove = vi.fn()
    const { getByLabelText } = render(
      wrap(
        <SlotCard
          id="e"
          title="Reverb"
          valueLabel="mix 0.20"
          position={3}
          total={3}
          enabled
          defaultExpanded
          onToggleEnabled={() => {}}
          onRemove={onRemove}
        >
          <div />
        </SlotCard>,
        ['e'],
      ),
    )
    fireEvent.click(getByLabelText('Remove Reverb'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('caret toggles aria-expanded between true and false', () => {
    const { getByLabelText } = render(
      wrap(
        <SlotCard
          id="f"
          title="Pitch"
          valueLabel="+0 st 1.00x"
          position={1}
          total={1}
          enabled
          defaultExpanded
          onToggleEnabled={() => {}}
          onRemove={() => {}}
        >
          <div>body</div>
        </SlotCard>,
        ['f'],
      ),
    )
    const collapseBtn = getByLabelText('Collapse Pitch')
    expect(collapseBtn.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(collapseBtn)
    const expandBtn = getByLabelText('Expand Pitch')
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false')
  })
})
