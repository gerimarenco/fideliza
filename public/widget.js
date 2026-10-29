// Widget embebible de Retornar para tiendas online (ver README, sección
// "Widget de fidelización para tiendas online"). Uso en la página de
// producto de la tienda:
//
//   <div data-retornar-widget data-negocio="peperina" data-precio="18320"></div>
//   <script src="https://retornar.com.ar/widget.js" defer></script>
//
// data-negocio: el slug del negocio en Retornar (ver "Integraciones" en el
// panel del negocio). data-precio: el precio final del producto, en pesos,
// sin separadores de miles ni símbolo de moneda.
//
// No depende de nada del tema de la tienda (no scrapea el DOM buscando el
// precio) para no romperse cada vez que la tienda cambia de diseño — el
// precio lo pone la propia tienda en el data-precio de este div.
(function () {
  function crearLink(el, datos, puntos) {
    var base = el.getAttribute('data-retornar-base') || 'https://retornar.com.ar'
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
    // Ícono lineal de la bolsa (ShoppingBag de lucide, el mismo que usa
    // Retornar para "sumás puntos con cada compra"), del color del texto del
    // botón. Antes iba el emoji del negocio, que se veía distinto en cada
    // dispositivo y no combinaba con la marca.
    var svgNs = 'http://www.w3.org/2000/svg'
    var icono = document.createElementNS(svgNs, 'svg')
    icono.setAttribute('width', '18')
    icono.setAttribute('height', '18')
    icono.setAttribute('viewBox', '0 0 24 24')
    icono.setAttribute('fill', 'none')
    icono.setAttribute('stroke', 'currentColor')
    icono.setAttribute('stroke-width', '1.75')
    icono.setAttribute('stroke-linecap', 'round')
    icono.setAttribute('stroke-linejoin', 'round')
    icono.setAttribute('aria-hidden', 'true')
    icono.style.cssText = 'flex-shrink:0;display:block;'
    var trazos = ['M16 10a4 4 0 0 1-8 0', 'M3.103 6.034h17.794', 'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z']
    for (var t = 0; t < trazos.length; t++) {
      var trazo = document.createElementNS(svgNs, 'path')
      trazo.setAttribute('d', trazos[t])
      icono.appendChild(trazo)
    }
    link.appendChild(icono)
    link.appendChild(document.createTextNode(
      '¡Registrate en ' + datos.nombre + ' y sumá hasta ' + puntos + ' puntos con esta compra!'
    ))
    return link
  }

  function iniciar(el) {
    var negocio = el.getAttribute('data-negocio')
    var precio = parseFloat(el.getAttribute('data-precio'))
    if (!negocio || !Number.isFinite(precio) || precio < 0) return

    var base = el.getAttribute('data-retornar-base') || 'https://retornar.com.ar'

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

  var elementos = document.querySelectorAll('[data-retornar-widget]')
  for (var i = 0; i < elementos.length; i++) {
    iniciar(elementos[i])
  }
})()
