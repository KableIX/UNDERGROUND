# GPS recovery & offline sessions

## Implemented (pure / tested)

- Ordered GPS buffer merge with timestamp dedupe (`mergeGpsBuffers`)
- Gap detection (`findGpsGaps`)
- Offline session recovery planner (`recoverOfflineSession`) — recoverable / force evidence review / abandoned
- Sim GPS replay + checkpoint sampling for SV DEV (`buildSimGpsReplay`)

## Planned (device / Apple)

- iOS background location resume after process death
- Secure on-device encrypted session blob
- Server checkpoint watermark ack on reconnect
- Gap > threshold forcing `EVIDENCE_REVIEW` on live runs (engine helper ready; device path untested)

## Production gate

Simulation evidence and development district captures **must never** write production ownership. Offline recovery cannot bypass district/draft gates.
