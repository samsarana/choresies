/** Tiny dependency-free confetti. Alpenglow palette, reduced-motion aware. */

const PALETTE = ['#F6CE5B', '#E4A72E', '#EF8A76', '#5C6491', '#4C7A5E', '#FFFDF6']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  w: number
  h: number
  color: string
  round: boolean
  born: number
  ttl: number
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '999',
  })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  return { canvas, ctx }
}

function run(particles: Particle[], gravity: number, done?: () => void): void {
  const { canvas, ctx } = makeCanvas()
  let raf = 0
  const tick = (now: number) => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let alive = 0
    for (const p of particles) {
      const age = now - p.born
      if (age > p.ttl) continue
      alive++ // not-yet-born particles count as alive, or the first frame
      if (age < 0) continue // of a delayed rain tears the canvas down early
      p.vy += gravity
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vrot
      const fade = age > p.ttl - 300 ? (p.ttl - age) / 300 : 1
      ctx.save()
      ctx.globalAlpha = Math.max(0, fade)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      }
      ctx.restore()
    }
    if (alive > 0) {
      raf = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(raf)
      canvas.remove()
      done?.()
    }
  }
  raf = requestAnimationFrame(tick)
}

/** Celebratory burst from a point (e.g. the button you just tapped). */
export function burstConfetti(x: number, y: number): void {
  if (reducedMotion()) return
  const now = performance.now()
  const particles: Particle[] = []
  for (let i = 0; i < 90; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
    const speed = 4 + Math.random() * 7
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      w: 4 + Math.random() * 5,
      h: 6 + Math.random() * 6,
      color: PALETTE[i % PALETTE.length],
      round: Math.random() < 0.25,
      born: now,
      ttl: 900 + Math.random() * 600,
    })
  }
  run(particles, 0.22)
}

/** Gentle celebratory drizzle from the top (new-week leader moment). */
export function rainConfetti(durationMs = 2200): void {
  if (reducedMotion()) return
  const now = performance.now()
  const particles: Particle[] = []
  const count = 110
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 1.4 + Math.random() * 1.8,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.2,
      w: 4 + Math.random() * 5,
      h: 6 + Math.random() * 6,
      color: PALETTE[i % PALETTE.length],
      round: Math.random() < 0.25,
      born: now + Math.random() * durationMs * 0.6,
      ttl: 2600 + Math.random() * 1200,
    })
  }
  run(particles, 0.035)
}
