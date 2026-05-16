import type { Locator, Page } from 'playwright'

export class UI5ElementNotFoundError extends Error {
  constructor(
    public readonly componentType: string,
    public readonly labelOrId: string,
    public readonly screenshotPath?: string,
  ) {
    super(`UI5 element not found: [${componentType}] "${labelOrId}"`)
  }
}

export class UI5Adapter {
  constructor(private readonly page: Page) {}

  async waitForUI5Ready(page: Page = this.page): Promise<void> {
    await page.waitForFunction(
      () => (window as typeof window & { sap?: { ui?: { getCore?: () => { isInitialized: () => boolean } } } }).sap?.ui?.getCore?.()?.isInitialized?.() === true,
      { timeout: 30_000 },
    )
    const busyStart = Date.now()
    while (Date.now() - busyStart < 10_000) {
      const busy = await page.evaluate(
        () => document.querySelectorAll('[data-sap-ui-busy="true"]').length,
      )
      if (busy === 0) break
      await new Promise((r) => setTimeout(r, 500))
    }
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)
  }

  async findElement(componentType: string, labelOrId: string): Promise<Locator> {
    const strategies = [
      () => this.page.locator(`pierce/[aria-label="${labelOrId}"]`).first(),
      () => this.page.locator(`[data-sap-ui="${labelOrId}"]`).first(),
      () => this.page.locator(`[id*="${labelOrId}"]`).first(),
      ...(componentType.toLowerCase().includes('button')
        ? [() => this.page.locator(`pierce/[role="button"]:has-text("${labelOrId}")`).first()]
        : []),
    ]

    for (const strategy of strategies) {
      try {
        const locator = strategy()
        await locator.waitFor({ state: 'visible', timeout: 15_000 })
        return locator
      } catch {}
    }

    const ts = Date.now()
    const screenshotPath = `logs/ui5-fail-${ts}.png`
    await this.page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null)
    throw new UI5ElementNotFoundError(componentType, labelOrId, screenshotPath)
  }

  async click(componentType: string, labelOrId: string): Promise<void> {
    try {
      const locator = await this.findElement(componentType, labelOrId)
      await locator.click()
    } catch (err) {
      if (err instanceof Error && err.message.includes('stale')) {
        const locator = await this.findElement(componentType, labelOrId)
        await locator.click()
        return
      }
      throw err
    }
  }

  async fill(componentType: string, labelOrId: string, value: string): Promise<void> {
    try {
      const locator = await this.findElement(componentType, labelOrId)
      await locator.fill(value)
    } catch (err) {
      if (err instanceof Error && err.message.includes('stale')) {
        const locator = await this.findElement(componentType, labelOrId)
        await locator.fill(value)
        return
      }
      throw err
    }
  }
}
