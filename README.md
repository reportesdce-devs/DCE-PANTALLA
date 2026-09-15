# DCE Display

Pantalla informativa y panel de administración para la División de Ciencias Exactas del IEST Anáhuac.

## Rutas

- `/`: display público responsive para pantallas, tabletas y móviles.
- `/admin/`: panel protegido para eventos, avisos, evidencias, carreras, promoción y configuración.

Publicación en GitHub Pages: `https://reportesdce-devs.github.io/DCE-PANTALLA/`

## Conexión a Supabase

El proyecto apunta a `https://zruztkzddsyskzqfiicv.supabase.co` y utiliza su clave **Publishable** desde `assets/supabase.js`.

No uses la clave `service_role` ni una clave secreta en archivos del navegador.

La migración `supabase/migrations/20260914213000_create_display_cms.sql` contiene tablas, políticas RLS, datos iniciales y el bucket público `event-media`.

## Primer administrador

1. Abre `/admin/` y crea la cuenta con el correo institucional.
2. Confirma el correo si Supabase lo solicita.
3. Desde SQL Editor, ejecuta este bloque reemplazando el correo:

```sql
insert into public.admin_users (user_id, email, display_name)
select id, email, 'Administrador DCE'
from auth.users
where lower(email) = lower('correo@iest.edu.mx')
on conflict (user_id) do update set
  email = excluded.email,
  display_name = excluded.display_name;
```

Después de esta alta, la cuenta podrá iniciar sesión y administrar el contenido. Las demás cuentas registradas no obtienen permisos automáticamente.

## Desarrollo local

Sirve la carpeta con cualquier servidor HTTP estático. Los módulos ES no funcionan correctamente abriendo `index.html` directamente con `file://`.
