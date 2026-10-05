-- Carga el texto real de "Bases y condiciones" que mandó Cecilia, que hasta
-- ahora vivía hardcodeado en app/page.js (BASES_CONDICIONES_PEPERINA) y se
-- mostraba igual sin importar qué negocio estuviera viendo el cliente. Con
-- basesCondiciones pasando a ser un campo editable por negocio (ver
-- app/api/negocios), este UPDATE es lo que mantiene el texto de Peperina sin
-- que se pierda al sacar la constante del código. Solo toca el negocio real
-- y activo, mismo criterio que 20260826000605_set_tema_peperina.
UPDATE "Negocio"
SET "basesCondiciones" = $bases$1. ¿Qué es Club Peperina?

Club Peperina es nuestro programa de beneficios para premiar a quienes nos eligen. Al formar parte del Club, acumulás puntos con tus compras y podés canjearlos por premios y beneficios especiales.

2. ¿Cómo sumo puntos?

Por cada $100 abonados sumás 1 punto.
Los puntos se calculan sobre el importe final efectivamente pagado, una vez aplicados los descuentos o promociones correspondientes.
Podés sumar puntos tanto en nuestro local como en la tienda online, siempre que la compra sea facturada con los datos de la clienta registrada en Club Peperina. La acreditación de los puntos se realiza automáticamente a partir de la facturación.

3. ¿Cuánto duran mis puntos?

Cada punto tiene una vigencia de 12 meses desde la fecha en que fue obtenido. Cumplido ese plazo, los puntos no utilizados vencen automáticamente.

4. ¿Cómo canjeo mis puntos?

Cuando alcanzás los puntos necesarios para un premio, podés elegir canjearlos o continuar acumulando.
Al realizar un canje, se descuentan de tu saldo los puntos correspondientes al premio elegido. Si te quedan puntos disponibles, los conservás y seguís acumulando desde ese saldo.

5. Premios disponibles

Los premios pueden renovarse a lo largo del año y están sujetos a disponibilidad de stock.
Peperina podrá incorporar nuevos premios, reemplazar los existentes o modificar la cantidad de puntos necesarios para futuros canjes.

6. Beneficios con descuento

Cuando un premio consista en un descuento, se aplicarán las condiciones particulares informadas para ese beneficio.
Actualmente, el beneficio de 50% OFF en una prenda a elección requiere 15.000 puntos, tiene un tope máximo de descuento de $75.000 y no es acumulable con otras promociones, descuentos o beneficios vigentes.

7. Cambios

Los cambios de prendas se rigen por la política habitual de cambios de Peperina. La generación de puntos está vinculada a la facturación realizada con los datos de la clienta.

8. Condiciones generales

Los puntos son personales, no tienen valor en dinero, no pueden canjearse por efectivo ni transferirse a otra persona.
Peperina podrá actualizar las condiciones y los premios del programa. Cualquier modificación relevante será comunicada a los miembros de Club Peperina.$bases$
WHERE "nombre" = 'Peperina' AND "activo" = true;
