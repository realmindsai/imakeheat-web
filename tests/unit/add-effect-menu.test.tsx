import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AddEffectMenu } from '../../src/components/AddEffectMenu'
import { registry } from '../../src/audio/effects/registry'

describe('AddEffectMenu', () => {
  it('shows + Add effect button and is closed by default', () => {
    const { getByRole, queryByRole } = render(<AddEffectMenu onAdd={() => {}} />)
    const btn = getByRole('button', { name: '+ Add effect' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(queryByRole('menu')).toBeNull()
  })

  it('opens the menu and lists every registered effect', () => {
    const { getByRole, getAllByRole } = render(<AddEffectMenu onAdd={() => {}} />)
    fireEvent.click(getByRole('button', { name: '+ Add effect' }))
    expect(getByRole('menu')).toBeTruthy()
    const items = getAllByRole('menuitem')
    expect(items.length).toBe(registry.size)
    const names = items.map((el) => el.textContent)
    for (const def of registry.values()) {
      expect(names).toContain(def.displayName)
    }
    expect(items.length).toBe(6)
  })

  it('clicking an item calls onAdd with the kind and closes the menu', () => {
    const onAdd = vi.fn()
    const { getByRole, queryByRole, getAllByRole } = render(<AddEffectMenu onAdd={onAdd} />)
    fireEvent.click(getByRole('button', { name: '+ Add effect' }))
    const items = getAllByRole('menuitem')
    fireEvent.click(items[0])
    const firstKind = Array.from(registry.values())[0].kind
    expect(onAdd).toHaveBeenCalledWith(firstKind)
    expect(queryByRole('menu')).toBeNull()
  })
})
