import * as THREE from 'three'
import type { Skill } from './stack'
import { colorOf } from './stack'

// Draws one block face (glyph chip + name) into a canvas texture.
// Canvas textures keep the build free of font files for the 3D text and
// reuse the webfonts already loaded for the page.

const W = 512
const H = 154

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function makeLabelTexture(skill: Skill, maxAnisotropy: number): THREE.CanvasTexture {
  const color = colorOf(skill)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#120c2e')
  bg.addColorStop(1, '#07051a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = color
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 4
  roundRect(ctx, 6, 6, W - 12, H - 12, 14)
  ctx.stroke()
  ctx.globalAlpha = 1

  const chip = 98
  const cx = 28
  const cy = (H - chip) / 2
  ctx.fillStyle = color
  roundRect(ctx, cx, cy, chip, chip, 20)
  ctx.fill()

  ctx.fillStyle = '#050310'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${skill.glyph.length > 1 ? 46 : 56}px "Space Grotesk", system-ui, sans-serif`
  ctx.fillText(skill.glyph, cx + chip / 2, cy + chip / 2 + 3)

  ctx.fillStyle = '#eef2ff'
  ctx.textAlign = 'left'
  let size = 54
  const maxText = W - (cx + chip + 26) - 28
  do {
    ctx.font = `500 ${size}px "Space Grotesk", system-ui, sans-serif`
    size -= 2
  } while (ctx.measureText(skill.name).width > maxText && size > 24)
  ctx.fillText(skill.name, cx + chip + 26, H / 2 + 3)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(8, maxAnisotropy)
  return tex
}
