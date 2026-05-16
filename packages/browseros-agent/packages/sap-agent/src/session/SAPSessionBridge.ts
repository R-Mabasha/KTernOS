import { EventEmitter } from 'node:events'
import type { SAPSession, SessionBridge, SessionEvent } from '../types'

export class SAPSessionBridge implements SessionBridge {
  private session: SAPSession | null = null
  private readonly emitter = new EventEmitter()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly pollIntervalMs = 60_000) {}

  acceptFromExtension(session: SAPSession): void {
    this.session = {
      cfToken: session.cfToken,
      xsuaaToken: session.xsuaaToken,
      cookies: { ...session.cookies },
      expiresAt: session.expiresAt,
    }
    this.emitter.emit('event', { type: 'session:updated', expiresAt: session.expiresAt } satisfies SessionEvent)
    this.startWatchdog()
  }

  async getSession(): Promise<SAPSession> {
    if (!this.session) throw new Error('SAP session unavailable. Re-authentication required.')
    if (Date.now() >= this.session.expiresAt) {
      this.emitter.emit('event', { type: 'session:expired', reason: 'token-expired' } satisfies SessionEvent)
      throw new Error('SAP session expired. Re-authentication required.')
    }
    return {
      cfToken: this.session.cfToken,
      xsuaaToken: this.session.xsuaaToken,
      cookies: { ...this.session.cookies },
      expiresAt: this.session.expiresAt,
    }
  }

  watchSession(cb: (event: SessionEvent) => void): () => void {
    this.emitter.on('event', cb)
    return () => this.emitter.off('event', cb)
  }

  clear(): void {
    this.session = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private startWatchdog(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => {
      if (!this.session) return
      if (Date.now() >= this.session.expiresAt) {
        this.emitter.emit('event', { type: 'session:expired', reason: 'token-expired' } satisfies SessionEvent)
      }
    }, this.pollIntervalMs)
  }
}
