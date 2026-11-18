<script setup lang="ts">
import { computed } from 'vue'
import type { SankeyPresentation } from './aiResultView'

const props = defineProps<{ data: SankeyPresentation }>()

const palette = ['#075b91', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d']

const layout = computed(() => {
  const sourceTotals = new Map<string, number>()
  const targetTotals = new Map<string, number>()
  for (const link of props.data.links) {
    sourceTotals.set(link.source, (sourceTotals.get(link.source) ?? 0) + link.value)
    targetTotals.set(link.target, (targetTotals.get(link.target) ?? 0) + link.value)
  }
  const sources = [...sourceTotals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const targets = [...targetTotals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const width = 960
  const height = Math.min(1400, Math.max(360, Math.max(sources.length, targets.length) * 28 + 40))
  const gap = 7
  const available = height - 40
  const sourceSpace = available - gap * Math.max(0, sources.length - 1)
  const targetSpace = available - gap * Math.max(0, targets.length - 1)
  const sourceTotal = sources.reduce((sum, [, value]) => sum + value, 0)
  const targetTotal = targets.reduce((sum, [, value]) => sum + value, 0)
  const scale = Math.min(sourceSpace / sourceTotal, targetSpace / targetTotal)
  const nodeWidth = 14
  const sourceX = 176
  const targetX = 770

  function makeNodes(entries: Array<[string, number]>, x: number, side: 'source' | 'target') {
    let y = 20
    return entries.map(([label, total], index) => {
      const node = { label, total, x, y, width: nodeWidth, height: total * scale, side, color: palette[index % palette.length] ?? '#075b91' }
      y += node.height + gap
      return node
    })
  }

  const sourceNodes = makeNodes(sources, sourceX, 'source')
  const targetNodes = makeNodes(targets, targetX, 'target')
  const sourceByLabel = new Map(sourceNodes.map((node) => [node.label, node]))
  const targetByLabel = new Map(targetNodes.map((node) => [node.label, node]))
  const sourceOffsets = new Map<string, number>()
  const targetOffsets = new Map<string, number>()
  const ribbons = props.data.links.flatMap((link) => {
    const source = sourceByLabel.get(link.source)
    const target = targetByLabel.get(link.target)
    if (!source || !target) return []
    const sourceOffset = sourceOffsets.get(link.source) ?? 0
    const targetOffset = targetOffsets.get(link.target) ?? 0
    const ribbonHeight = link.value * scale
    sourceOffsets.set(link.source, sourceOffset + ribbonHeight)
    targetOffsets.set(link.target, targetOffset + ribbonHeight)
    const y0 = source.y + sourceOffset
    const y1 = y0 + ribbonHeight
    const y2 = target.y + targetOffset
    const y3 = y2 + ribbonHeight
    const startX = source.x + source.width
    const endX = target.x
    const curve = (endX - startX) * 0.48
    return [{
      key: `${link.source}:${link.target}`,
      path: `M ${startX} ${y0} C ${startX + curve} ${y0}, ${endX - curve} ${y2}, ${endX} ${y2} L ${endX} ${y3} C ${endX - curve} ${y3}, ${startX + curve} ${y1}, ${startX} ${y1} Z`,
      color: source.color,
      value: link.value,
    }]
  })

  return { width, height, sourceNodes, targetNodes, ribbons }
})
</script>

<template>
  <div style="width: 100%; max-height: 560px; overflow: auto; margin: 8px 0 24px">
    <svg
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      role="img"
      :aria-label="`Sankey diagram from ${data.sourceLabel} to ${data.targetLabel}, weighted by ${data.valueLabel}`"
      style="display: block; width: 100%; min-width: 680px; height: auto"
    >
      <text x="176" y="14" text-anchor="end" fill="#475569" font-size="13" font-weight="600">
        {{ data.sourceLabel }}
      </text>
      <text x="788" y="14" text-anchor="start" fill="#475569" font-size="13" font-weight="600">
        {{ data.targetLabel }}
      </text>
      <g v-for="ribbon in layout.ribbons" :key="ribbon.key">
        <path :d="ribbon.path" :fill="ribbon.color" fill-opacity="0.36">
          <title>{{ ribbon.value.toLocaleString() }}</title>
        </path>
      </g>
      <g v-for="node in layout.sourceNodes" :key="`source-${node.label}`">
        <rect :x="node.x" :y="node.y" :width="node.width" :height="node.height" :fill="node.color" rx="2" />
        <text :x="node.x - 9" :y="node.y + node.height / 2" text-anchor="end" dominant-baseline="middle" fill="#334155" font-size="12">
          {{ node.label }} · {{ node.total.toLocaleString() }}
        </text>
      </g>
      <g v-for="node in layout.targetNodes" :key="`target-${node.label}`">
        <rect :x="node.x" :y="node.y" :width="node.width" :height="node.height" :fill="node.color" rx="2" />
        <text :x="node.x + node.width + 9" :y="node.y + node.height / 2" text-anchor="start" dominant-baseline="middle" fill="#334155" font-size="12">
          {{ node.label }} · {{ node.total.toLocaleString() }}
        </text>
      </g>
    </svg>
  </div>
</template>
