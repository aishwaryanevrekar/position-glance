import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
  AudioInputSource,
} from '@evenrealities/even_hub_sdk'

// Position Glance — Track 02: Crypto & DeFi
// One position on the lens. Voice phrase -> reduce-only intent -> explicit tap -> signed testnet order.
// No API keys in this bundle. All calls go to our backend.

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8787'

type Position = {
  empty: boolean
  simulated: boolean
  rows: string[]
  coin?: string
  size?: number
  side?: 'buy' | 'sell'
  price?: number
  mark?: number
  pnl?: number
  roe?: number
}

type Phase = 'glance' | 'listening' | 'draft' | 'sending' | 'result'

let phase: Phase = 'glance'
let position: Position | null = null
let pending: { intent: any; order: any; confirmToken: string } | null = null
let audioChunks: Uint8Array[] = []
let busy = false

const TEXT = (content: string) =>
  new TextContainerUpgrade({ containerID: 1, containerName: 'main', content })

const bridge = await waitForEvenAppBridge()

const mainContainer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 6,
  containerID: 1,
  containerName: 'main',
  content: 'POSITION GLANCE\nLoading testnet…',
  isEventCapture: 1,
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [mainContainer] }),
)
console.log('[glance] page created:', created === 0 ? 'ok' : `failed ${created}`)

function show(content: string) {
  bridge.textContainerUpgrade(TEXT(content))
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BACKEND}${path}`, init)
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`)
  return res.json()
}

async function refreshPosition() {
  if (busy || phase === 'draft' || phase === 'listening') return
  try {
    const data = await api('/api/position')
    position = data.position
    if (phase === 'glance') renderGlance()
  } catch (e: any) {
    if (phase === 'glance') show(`POSITION GLANCE\nBackend offline\n${String(e.message).slice(0, 60)}`)
  }
}

function renderGlance() {
  if (!position) return show('POSITION GLANCE\nNo position data')
  const rows = position.rows.slice(0, 4).join('\n')
  show(`${rows}\n\nTAP voice · 2× exit`)
}

async function startListening() {
  phase = 'listening'
  audioChunks = []
  show('LISTENING\nSay: close half my BTC long\nTAP to stop · 2× exit')
  await bridge.audioControl(true, AudioInputSource.Glasses)
}

async function stopListening() {
  busy = true
  await bridge.audioControl(false)
  phase = 'glance'
  renderGlance()
  try {
    const pcm = concat(audioChunks)
    if (!pcm.length) {
      show('NO AUDIO HEARD\nTAP to retry\n2× to exit')
      busy = false
      return
    }
    show('UNDERSTANDING…')
    const stt = await api('/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'audio/pcm' },
      body: pcm as unknown as BodyInit,
    })
    const parsed = await api('/api/intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: stt.text, position }),
    })
    if (!parsed.order) {
      phase = 'result'
      show(`NO ORDER\n${String(parsed.message).slice(0, 70)}\n\nTAP to retry`)
      busy = false
      return
    }
    pending = { intent: parsed.intent, order: parsed.order, confirmToken: parsed.confirmToken }
    phase = 'draft'
    const o = parsed.order
    show(`"${String(stt.text).slice(0, 48)}"\n\n${o.side.toUpperCase()} ${o.size} ${o.coin} REDUCE-ONLY\n\nTAP=YES · SWIPE=NO`)
  } catch (e: any) {
    phase = 'result'
    show(`ERROR\n${String(e.message).slice(0, 70)}\n\nTAP to retry`)
  } finally {
    busy = false
  }
}

async function confirm(yes: boolean) {
  if (busy) return
  busy = true
  if (!yes) {
    pending = null
    phase = 'glance'
    renderGlance()
    busy = false
    return
  }
  phase = 'sending'
  show('SENDING TESTNET ORDER…')
  try {
    const result = await api('/api/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmToken: pending?.confirmToken, confirmed: true }),
    })
    phase = 'result'
    const label = result.label || (result.simulated ? 'SIMULATED' : 'TESTNET')
    show(`${label}\n${result.ok ? 'ORDER ACCEPTED' : 'NOT SENT'}\n${String(result.txId || '').slice(0, 20)}\n\nTAP to retry`)
    pending = null
  } catch (e: any) {
    phase = 'result'
    show(`SEND FAILED\n${String(e.message).slice(0, 70)}\n\nTAP to retry`)
  } finally {
    busy = false
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

// Resolve CLICK inside the envelope: protobuf omits zero, so a tap may be undefined.
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

const unsubscribe = bridge.onEvenHubEvent((event: any) => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)
  const type = sysType ?? textType

  // Root-level exit must always work.
  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)
    return
  }

  if (event.audioEvent?.audioPcm) {
    if (phase === 'listening') audioChunks.push(new Uint8Array(event.audioEvent.audioPcm))
    return
  }

  if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT || type === OsEventTypeList.SCROLL_TOP_EVENT) {
    if (phase === 'draft') void confirm(false) // swipe = NO / cancel
    return
  }

  if (type === OsEventTypeList.CLICK_EVENT) {
    if (phase === 'glance' || phase === 'result') void startListening()
    else if (phase === 'listening') void stopListening()
    else if (phase === 'draft') void confirm(true) // tap = explicit YES
    else if (phase === 'result') { phase = 'glance'; renderGlance() }
  }

  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    unsubscribe()
  }
})

void refreshPosition()
setInterval(refreshPosition, 15_000)
