import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../App.tsx'

function sectionsNav() {
  return within(screen.getByRole('navigation', { name: 'Sections' }))
}

async function linkSimulatedSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(sectionsNav().getByRole('button', { name: 'Connection' }))
  await user.click(await screen.findByRole('button', { name: 'Simulated bench interface' }))
  await user.click(sectionsNav().getByRole('button', { name: 'Vehicle' }))
  await user.click(screen.getByRole('button', { name: '2007 Volvo XC70 D5' }))
  await user.click(sectionsNav().getByRole('button', { name: 'Connection' }))
  await user.click(screen.getByRole('button', { name: 'Confirm link' }))
  expect(await screen.findByText('Simulated session')).toBeInTheDocument()
}

describe('P2 Diagnostics shell', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with no interface and explains that trouble codes need a connection', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('No interface selected')
    await user.click(sectionsNav().getByRole('button', { name: 'Trouble codes' }))
    expect(screen.getByText(/a connection is required before trouble codes can be read/i)).toBeInTheDocument()
  })

  it('shows the simulated banner and a SIM- code after the link is confirmed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await linkSimulatedSession(user)
    await user.click(sectionsNav().getByRole('button', { name: 'Trouble codes' }))
    expect(screen.getByRole('button', { name: /SIM-/ })).toBeInTheDocument()
  })

  it('explains that ECU research needs a connection, then shows a simulated EGR reading online', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(sectionsNav().getByRole('button', { name: 'ECU research' }))
    expect(screen.getByRole('heading', { name: 'ECU research' })).toBeInTheDocument()
    expect(screen.getAllByText(/a connection is required/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('0.18')).not.toBeInTheDocument()
    expect(screen.queryByText('SIM-ECM-1')).not.toBeInTheDocument()
    expect(screen.getByText('Not identified')).toBeInTheDocument()
    expect(screen.getByText('Not read')).toBeInTheDocument()

    await linkSimulatedSession(user)
    await user.click(sectionsNav().getByRole('button', { name: 'ECU research' }))
    expect(screen.getByText('0.18')).toBeInTheDocument()
    expect(screen.getByText('SIM-ECM-1')).toBeInTheDocument()
    expect(screen.getAllByText('Simulated').length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/a connection is required/i)).toHaveLength(0)
    expect(screen.getByText('Not identified')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(screen.queryByText('0.18')).not.toBeInTheDocument()
    expect(screen.queryByText('SIM-ECM-1')).not.toBeInTheDocument()
    expect(screen.getAllByText(/a connection is required/i).length).toBeGreaterThan(0)
  })

  it('drops the sample code on disconnect and keeps the vehicle label', async () => {
    const user = userEvent.setup()
    render(<App />)
    await linkSimulatedSession(user)
    await user.click(sectionsNav().getByRole('button', { name: 'Trouble codes' }))
    expect(screen.getByRole('button', { name: /SIM-/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(screen.queryByRole('button', { name: /SIM-/ })).not.toBeInTheDocument()
    expect(screen.getByText('2007 Volvo XC70 D5')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Vehicle selected, link not confirmed')
  })
})
