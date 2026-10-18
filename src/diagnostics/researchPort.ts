export interface ResearchIdentityReading {
  softwareId: string
  engineFamily: 'Not identified'
  result: 'Simulated identity only'
  simulated: true
}

export interface EgrReading {
  sensor: string
  vvt: string
  simulated: true
}

export type DpfReadiness = 'Incomplete' | 'Ready'

export interface DpfReading {
  level: number
  levelText: string
  readiness: DpfReadiness
  simulated: true
}

export interface ResearchPort {
  readResearchIdentity(): Promise<ResearchIdentityReading>
  readEgr(): Promise<EgrReading>
  readDpf(): Promise<DpfReading>
  currentSimulatedImage(): Promise<Uint8Array>
}
