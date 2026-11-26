/**
 * Purpose
 * Provide the print airesult logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// Define the helper that will print airesult.
export async function printAIResult(source: HTMLElement, question: string): Promise<void> {
  // Use document.createElement to initialize frame.
  const frame = document.createElement('iframe')
  // Update frame.title with the value on the right.
  frame.title = 'Print AI result'
  // Call frame.setAttribute to run this step.
  frame.setAttribute('aria-hidden', 'true')
  // Call Object.assign to run this step.
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', width: '1100px', height: '800px', border: '0' })
  // Call document.body.appendChild to run this step.
  document.body.appendChild(frame)
  // Define target for the steps below.
  const target = frame.contentDocument
  // Define win for the steps below.
  const win = frame.contentWindow
  // Check whether !target || !win before running this branch.
  if (!target || !win) { frame.remove(); throw new Error('Print preview could not open.') }
  // Update target.title with the value on the right.
  target.title = 'ESA AI result'
  // Use target.createElement to initialize style.
  const style = target.createElement('style')
  // Update style.textContent with the value on the right.
  style.textContent = `@page { size: auto; margin: 14mm; } body { font: 12pt Arial, sans-serif; color: #17212b; background: white; } h1 { font-size: 20pt; } table { width: 100%; border-collapse: collapse; } th,td { padding: 8px; border-bottom: 1px solid #ddd; } img,svg { width: 100%; height: auto; max-width: 100%; } svg text { font: 12px Arial; fill: #17212b; } [data-no-print] { display:none !important; } * { overflow: visible !important; max-width: 100% !important; box-shadow:none !important; } tr,img,svg { break-inside:avoid; }`
  // Call target.head.appendChild to run this step.
  target.head.appendChild(style)
  // Use target.createElement to initialize title.
  const title = target.createElement('h1'); title.textContent = 'ESA AI result'
  // Use target.createElement to initialize prompt.
  const prompt = target.createElement('p'); prompt.textContent = `Question: ${question}`
  // Use target.createElement to initialize date.
  const date = target.createElement('p'); date.textContent = `Printed ${new Date().toLocaleString()} · Source: ESA database`
  // Define clone for the steps below.
  const clone = source.cloneNode(true) as HTMLElement
  // Call clone.querySelectorAll('[data-no-print],button').forEach to run this step.
  clone.querySelectorAll('[data-no-print],button').forEach(node => node.remove())
  // Use source.querySelectorAll to initialize canvases.
  const canvases = source.querySelectorAll('canvas')
  // Call clone.querySelectorAll('canvas').forEach to run this step.
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    // Use target.createElement to initialize image.
    const image = target.createElement('img')
    // Update image.alt with the value on the right.
    image.alt = 'AI result chart'
    // Update image.src with the value on the right.
    image.src = canvases[index]!.toDataURL('image/png')
    // Call canvas.replaceWith to run this step.
    canvas.replaceWith(image)
  })
  // Call target.body.append to run this step.
  target.body.append(title, prompt, date, clone)
  try {
    await Promise.all(Array.from(target.images, image => image.decode().catch(() => undefined)))
    await target.fonts.ready
    // Call win.addEventListener to run this step.
    win.addEventListener('afterprint', () => frame.remove(), { once: true })
    // Call win.focus to run this step.
    win.focus()
    // Call win.print to run this step.
    win.print()
  } catch (error) { frame.remove(); throw error }
}
