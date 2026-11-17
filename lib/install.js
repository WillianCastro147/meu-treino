'use client';

// Instalar o Moviq na tela inicial (PWA).
// - Android/Chrome: o navegador dispara "beforeinstallprompt"; guardamos o evento para um botão "Instalar app".
// - iPhone/iPad: não existe botão de instalar; a tela mostra o passo a passo (Compartilhar > Adicionar à Tela de Início).
// - Navegador de dentro do Instagram/Facebook/TikTok: não instala; pedimos para abrir no Safari/Chrome.
// Importado no components/Providers.js para começar a escutar o evento assim que o app abre.
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'moviq_install_dismissed_at';
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // não mostra a barra automática; o botão da nossa tela abre a instalação
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|Line\//i.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

// Lembrete na tela Início: não insiste por 3 dias depois de "Agora não"
export function installDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at && Date.now() - at < 3 * 864e5;
  } catch (e) {
    return false;
  }
}
export function dismissInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch (e) {}
}

export function useInstall() {
  const [, force] = useState(0);
  const [info, setInfo] = useState({ standalone: false, platform: 'desktop', ready: false });
  useEffect(() => {
    setInfo({ standalone: isStandalone(), platform: detectPlatform(), ready: true });
    const fn = () => {
      setInfo((i) => ({ ...i, standalone: isStandalone() }));
      force((n) => n + 1);
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  async function prompt() {
    if (!deferredPrompt) return 'unavailable';
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    notify();
    return choice?.outcome || 'dismissed';
  }

  return { ...info, canPrompt: !!deferredPrompt, prompt };
}
