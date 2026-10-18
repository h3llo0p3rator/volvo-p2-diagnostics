# ECU architecture in this application

The workshop target is a 2007 XC70 D5. The ECU hardware id and the ECU software id for that vehicle are not established. A name scan of a reference diagnostics install did not contain a `Bosch`, `EDC16`, or `XC70` literal, and it did not produce a module id that belongs to this car. Until a future identification read says otherwise, this application keeps the engine family as "Not identified".

## Memory and calibration files

How the ECU organises memory, and how a calibration file is laid out, are unknown. This application does not draw a supplier map and does not treat imported bytes as calibration regions.

An image created by this application is a local container. Its three regions are Header, Identification, and Payload. That layout belongs to the simulated image. It is not an ECU memory map. A file from anywhere else, including a raw binary and a Motorola S-record, has no region map here. S-record text can be decoded for display. Addresses in those records are not turned into regions, and they are not used to program anything.

## Reads and programming

Reading identity, an EGR measurement, a DPF measurement, or trouble codes is a different activity from programming. This application implements the research reads as simulated values while the link phase is online. The module software id `SIM-ECM-1` is that stand-in. It is not an id read from the vehicle. Each simulated value is labelled Simulated. When the link is not online, those panels explain that a connection is required and they show no sample readings.

Programming that would modify an image or an ECU is refused. The programming panel can store a backup, compare a software id, and record a recovery plan. "Write firmware" returns a refused outcome and writes a log line. It does not change the stored bytes.

## Backup, integrity, and recovery

A backup is an opaque copy kept in memory on this workstation. The copy is not transmitted. Its length and SHA-256 are written to the operation log.

Integrity for an imported file is SHA-256 computed in this codebase. An image this application created also carries a SHA-256 seal of its payload. Recomputing that seal either matches or does not. Any other file is recorded as "Hash recorded" plus the hex digest. That result is not a pass or fail against an ECU checksum. The reference application's checksum symbols were not turned into an algorithm here.

Recovery is a plan. The log states that the backup file is the recovery artifact and that this build cannot apply it to hardware. There is no apply action.

## EGR and DPF

EGR and DPF are monitored measurements in this application. Online, EGR shows one simulated sensor reading and one simulated VVT reading. DPF shows a simulated level, that same level as text, and a readiness value supplied by the simulated port. A checkbox can show that no DPF variants were supplied. Nothing in this application changes EGR, changes DPF, calculates soot, or starts a regeneration.
