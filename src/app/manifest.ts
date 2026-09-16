import type { MetadataRoute } from 'next'

/**
 * Manifesto do atalho instalavel. O `start_url` aponta para o painel, nao
 * para o login: quem ja tem sessao entra direto ao tocar no icone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Autochat',
    short_name: 'Autochat',
    description: 'Painel de automacoes do Instagram',
    start_url: '/painel',
    display: 'standalone',
    background_color: '#f0f2f5',
    theme_color: '#0b1220',
    // O Android so oferece "Instalar" se existir icone de 192 e de 512.
    // Com o de 180 sozinho, o Chrome cria um atalho comum, que abre no
    // navegador em vez de abrir em tela cheia.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
