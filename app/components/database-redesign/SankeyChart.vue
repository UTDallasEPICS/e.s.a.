<script setup lang="ts">
  /**
   * Purpose
   * Render the sankey chart part of the ESA interface.
   *
   * Inputs
   * - The component’s props, shared state, and any user actions it handles.
   *
   * Outputs
   * - Rendered controls or content, plus events exposed to the parent where applicable.
   *
   * Pseudocode
   * Read the inputs → prepare values for display → render the template → respond to user actions.
   */
import { computed, useId } from 'vue'
import type { SankeyPresentation } from './aiResultPresentation'

// Use defineProps to initialize props.
const props = defineProps<{ data: SankeyPresentation }>()
// Use useId to initialize titleId.
const titleId = useId()
// Recalculate diagram when the values it reads change.
const diagram = computed(() => {
  // Use props.data.links.filter to initialize links.
  const links = props.data.links.filter(link => Number.isFinite(link.value) && link.value > 0)
  // Define sources for the steps below.
  const sources = [...new Set(links.map(link => link.source))]
  // Define targets for the steps below.
  const targets = [...new Set(links.map(link => link.target))]
  // Use Math.max to initialize height.
  const height = Math.max(280, Math.max(sources.length, targets.length) * 32 + 40)
  // Define gap for the steps below.
  const gap = 12
  // Use links.reduce to initialize total.
  const total = links.reduce((sum, link) => sum + link.value, 0)
  // Check whether !total before running this branch.
  if (!total) return { height, nodes: [], paths: [] }
  // Use Math.min to initialize space.
  const space = Math.min(height - 40 - gap * Math.max(0, sources.length - 1), height - 40 - gap * Math.max(0, targets.length - 1))
  // Define scale for the steps below.
  const scale = space / total

  // Define the helper that will column.
  function column(names: string[], side: 'source' | 'target') {
    // Define y for the steps below.
    let y = 20
    // Pass names.map((name, index) => { const value = links.filter(link => link[side] === name).reduce((sum, li back to the caller.
    return names.map((name, index) => {
      // Use links.filter(link => link[side] === name).reduce to initialize value.
      const value = links.filter(link => link[side] === name).reduce((sum, link) => sum + link.value, 0)
      // Define node for the steps below.
      const node = { name, value, y, height: value * scale, x: side === 'source' ? 220 : 650, side, color: `hsl(${index * 137.5 % 360} 48% 40%)`, used: 0 }
      y += node.height + gap
      // Pass node back to the caller.
      return node
    })
  }

  // Use column to initialize left.
  const left = column(sources, 'source')
  // Use column to initialize right.
  const right = column(targets, 'target')
  // Use links.map to initialize paths.
  const paths = links.map(link => {
    // Define source for the steps below.
    const source = left.find(node => node.name === link.source)!
    // Define target for the steps below.
    const target = right.find(node => node.name === link.target)!
    // Define thickness for the steps below.
    const thickness = link.value * scale
    // Define start for the steps below.
    const start = source.y + source.used
    // Define end for the steps below.
    const end = target.y + target.used
    source.used += thickness
    target.used += thickness
    // Pass { label: `${link.source} → ${link.target}: ${link.value} ${props.data.valueLabel}`, color: source.co back to the caller.
    return {
      label: `${link.source} → ${link.target}: ${link.value} ${props.data.valueLabel}`,
      color: source.color,
      d: `M 234 ${start} C 442 ${start}, 442 ${end}, 650 ${end} L 650 ${end + thickness} C 442 ${end + thickness}, 442 ${start + thickness}, 234 ${start + thickness} Z`,
    }
  })
  // Pass { height, nodes: [...left, ...right], paths } back to the caller.
  return { height, nodes: [...left, ...right], paths }
})

// Define the helper that will short label.
function shortLabel(value: string) {
  // Pass value.length > 29 ? value.slice(0, 28) + '…' : value back to the caller.
  return value.length > 29 ? value.slice(0, 28) + '…' : value
}
</script>

<template>
  <figure class="sankey-result">
    <figcaption>{{ data.sourceLabel }} → {{ data.targetLabel }} · {{ data.valueLabel }}</figcaption>
    <p v-if="!diagram.paths.length">No positive values to display.</p>
    <div v-else class="sankey-scroll">
      <svg :viewBox="'0 0 900 ' + diagram.height" role="img" :aria-labelledby="titleId">
        <title :id="titleId">{{ data.valueLabel }} flowing from {{ data.sourceLabel }} to {{ data.targetLabel }}</title>
        <path v-for="(path, index) in diagram.paths" :key="index" :d="path.d" :fill="path.color" fill-opacity="0.35">
          <title>{{ path.label }}</title>
        </path>
        <g v-for="node in diagram.nodes" :key="node.side + node.name">
          <rect :x="node.x" :y="node.y" width="14" :height="node.height" :fill="node.color">
            <title>{{ node.name }} · {{ node.value }} {{ data.valueLabel }}</title>
          </rect>
          <text :x="node.side === 'source' ? 210 : 674" :y="node.y + node.height / 2"
            :text-anchor="node.side === 'source' ? 'end' : 'start'" dominant-baseline="middle">
            {{ shortLabel(node.name) }}
            <title>{{ node.name }}</title>
          </text>
        </g>
      </svg>
    </div>
  </figure>
</template>

<style scoped>
.sankey-result { margin: 16px 0; }
figcaption { margin-bottom: 10px; font-weight: 600; }
.sankey-scroll { overflow-x: auto; }
svg { display: block; width: 100%; min-width: 680px; }
text { font-size: 12px; fill: currentColor; }
</style>
