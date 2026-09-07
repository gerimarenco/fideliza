// Widget embebible de Fideliza para tiendas online (ver README, sección
// "Widget de fidelización para tiendas online"). Uso en la página de
// producto de la tienda:
//
//   <div data-fideliza-widget data-negocio="peperina" data-precio="18320"></div>
//   <script src="https://<tu-dominio-de-fideliza>/widget.js" defer></script>
//
// data-negocio: el slug del negocio en Fideliza (ver "Integraciones" en el
// panel del negocio). data-precio: el precio final del producto, en pesos,
// sin separadores de miles ni símbolo de moneda.
//
// No depende de nada del tema de la tienda (no scrapea el DOM buscando el
// precio) para no romperse cada vez que la tienda cambia de diseño — el
// precio lo pone la propia tienda en el data-precio de este div.
(function () {
  function crearLink(el, datos, puntos) {
    var base = el.getAttribute('data-fideliza-base') || 'https://incomparable-zabaione-b58c21.netlify.app'
    var primario = datos.temaPrimario || '#111827'
    var primarioTexto = datos.temaPrimarioTexto || '#ffffff'

    var link = document.createElement('a')
    link.href = base + '/registro/' + encodeURIComponent(el.getAttribute('data-negocio'))
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.style.cssText =
      'display:inline-flex;align-items:center;gap:8px;padding:10px 14px;' +
      'border-radius:8px;background:' + primario + ';color:' + primarioTexto + ';' +
      'text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;line-height:1.3;'
    link.textContent = (datos.emoji ? datos.emoji + ' ' : '') +
      '¡Registrate en ' + datos.nombre + ' y sumá hasta ' + puntos + ' puntos con esta compra!'
    return link
  }

  function iniciar(el) {
    var negocio = el.getAttribute('data-negocio')
    var precio = parseFloat(el.getAttribute('data-precio'))
    if (!negocio || !Number.isFinite(precio) || precio < 0) return

    var base = el.getAttribute('data-fideliza-base') || 'https://incomparable-zabaione-b58c21.netlify.app'

    fetch(base + '/api/registro/' + encodeURIComponent(negocio))
      .then(function (res) {
        if (!res.ok) throw new Error('negocio no encontrado')
        return res.json()
      })
      .then(function (datos) {
        var puntos = Math.floor(precio / (datos.puntosXPeso || 1000))
        if (puntos <= 0) return
        el.appendChild(crearLink(el, datos, puntos))
      })
      .catch(function () {
        // Negocio no encontrado, inactivo, o error de red: no se muestra
        // nada en vez de romper la página de la tienda.
      })
  }

  var elementos = document.querySelectorAll('[data-fideliza-widget]')
  for (var i = 0; i < elementos.length; i++) {
    iniciar(elementos[i])
  }
})()
