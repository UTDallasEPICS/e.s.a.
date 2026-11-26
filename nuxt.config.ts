/**
 * Purpose
 * Provide the nuxt.config logic used by other parts of ESA.
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
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/image'],
  css: ['./assets/css/main.css'],

  runtimeConfig: {
    openrouterApiKey: '',
    openrouterModel: 'deepseek/deepseek-v4-flash-0731',
  },
})
