/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las pantallas públicas de cara al cliente (login, registro, la
  // landing de club) no tienen que quedar cacheadas en el navegador de
  // quien las visita -- si mejoramos algo ahí (ej. este mismo día,
  // agregar los campos de nombre/apellido al registro) y el navegador
  // sirve una versión vieja de la página contra el backend ya
  // actualizado, el resultado es un formulario roto y confuso para
  // alguien que ni siquiera sabe que existe un botón de "recargar
  // forzado". Pasó dos veces en la misma sesión (acá y con el redirect
  // de /login) -- mejor no depender de que cada visitante sepa hacer
  // Ctrl+Shift+R.
  async headers() {
    return [
      {
        source: '/login',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/registro/:negocio*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/club/:negocio*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default nextConfig;
