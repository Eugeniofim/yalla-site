/* Service worker — app-guia
   Estratégia: rede primeiro (o app novo chega sempre que houver internet),
   cache como reserva (o app abre mesmo sem internet).
   Para publicar uma atualização: subir os arquivos novos e trocar a VERSION. */
'use strict';

const VERSION = 'yalla-v1.3.0';
const CORE = [
  './', './index.html', './config.js', './app.js', './fx.js', './pix.js', './qr.js', './qrcode.js', './traduz.js', './store.js', './auth.js', './logo.js', './cloud.js', './nuvem-itens.js', './i18n.js', './es.js', './conteudo.js', './operacao.js', './operacao-telas.js', './precos.js', './assistente.js', './assistente-ingrid.js', './guia-link.js', './tokens.css', './operacao.css', './marca.css', './manifest.webmanifest', './capa.jpg', './home.jpg', './og.jpg', './guia.jpg', './arte/capa-arco.jpg', './arte/marmore.jpg',
  /* a arte da Yalla: o selo, o fundo da marca e as capas. Vao para o cache
     porque sao a cara do app — sem elas, offline, a vitrine fica cinza. */
  './arte/coroa.png', './arte/coroa-escura.png', './arte/logo-yalla.png', './arte/logo-yalla-escuro.png',
  './arte/fundo.svg', './arte/skyline.svg', './arte/skyline.jpg', './arte/reuniao.jpg', './arte/networking.jpg',
  './arte/deserto.jpg', './arte/iate.jpg', './arte/louvre.jpg', './arte/milla-rosto.jpg',
  /* a vitrine (v1.2.0): a foto do topo, a da Milla e as das categorias */
  './arte/home-dubai.jpg', './arte/home-dubai-cel.jpg', './arte/milla.jpg',
  './arte/cat-cultura.jpg', './arte/cat-deserto.jpg', './arte/cat-atracoes.jpg', './arte/cat-parques.jpg', './arte/cat-iate.jpg', './arte/cat-aventura.jpg', './arte/cat-gastronomia.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      /* so as versoes antigas deste app: a demonstracao mora no mesmo endereco
         e tem o cache dela */
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('yalla-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  /* O GitHub manda o index.html com max-age=600: o navegador guarda a pagina
     por 10 minutos e continua servindo a versao velha mesmo com recarga
     forcada. Para a pagina e para o codigo do app, furamos esse cache. */
  const ehApp = e.request.mode === 'navigate'
    || /\.(?:js|css|webmanifest)$/.test(url.pathname);
  e.respondWith(
    fetch(e.request, ehApp ? { cache: 'reload' } : undefined)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit ||
          (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
  );
});
