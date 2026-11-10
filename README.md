# Proyecto Riego Agrícola

Aplicación web construida con **Next.js (React)**, **SQLite** y **Prisma ORM** con migraciones versionadas para facilitar el trabajo colaborativo en el repositorio.

## Módulos implementados

### 1. Gestión de Usuarios y Autenticación
- Inicio y cierre de sesión con cookies firmadas (`HttpOnly`).
- Usuario administrador inicial creado automáticamente:
  - **Usuario:** `admin`
  - **Contraseña:** `1234`
- CRUD de usuarios con roles (`ADMIN`, `OPERADOR`), búsqueda, filtros por rol/estado y protección contra desactivación o eliminación del último administrador activo o del usuario en sesión.

### 2. Control de Riego por Zona (`/riego`)
- **Monitoreo en tiempo real y clima:** simulación de humedad del suelo combinada con condiciones climáticas obtenidas por coordenadas (Open-Meteo: temperatura, humedad relativa, viento y pronóstico de lluvia, con respaldo local automático si no hay conexión) y selector de escenarios climáticos (incluyendo clima adverso).
- **Horarios programados por parcela:** icono de reloj en cada parcela para abrir la ventana modal de programación (`irrigation_schedules`) con hora de inicio, duración, días de la semana y estado activo/pausado.
- **Automatización y suspensión climática:** ajusta automáticamente la duración del riego programado según pronóstico de lluvia y temperatura ambiente, y suspende automáticamente cualquier riego activo ante lluvia (con bloqueo habilitado), viento fuerte o temperaturas extremas.
- **Interruptores bajo demanda:** interruptor independiente de **Riego automático** por parcela (nunca se desactiva solo al finalizar un riego) e interruptor global de **Sensor de lluvia** junto con **Apagar si llueve** por parcela.
- **Caudal y aspersores:** visualización de cantidad de aspersores, caudal total (`L/min`), caudal por aspersor y agua aplicada durante el ciclo activo.
- **Cronómetro de riego y watchdog:** cada parcela muestra un contador en vivo del tiempo transcurrido desde el inicio del riego frente a su **tiempo máximo configurado**.
- **Validación automática:** detecta **Riego Insuficiente** (`< mínimo`), **Nivel Óptimo** y **Sobre-riego** (`> máximo`).
- **Trazabilidad en SQLite:** almacena lecturas históricas (`moisture_readings`), horarios (`irrigation_schedules`), configuración de sensor (`system_config`) y bitácora de eventos (`irrigation_events`) para análisis y reportes.

### 3. Gestión de Parcelas (`/parcelas`)
- Ventana dedicada para **crear, editar, activar/desactivar y eliminar** parcelas o zonas de cultivo.
- Configuración de cultivo, área (ha), **cantidad de aspersores** y **caudal de agua (L/min)**, **tiempo máximo de riego** (minutos o segundos), **bloqueo por lluvia**, **latitud y longitud**, y umbrales óptimos de humedad (`mínimo` y `máximo`).

## Requisitos

- Node.js `>= 18.17.0`
- npm

## Puesta en marcha

1. Instalar dependencias (genera automáticamente el cliente Prisma):

   ```bash
   npm install
   ```

2. Aplicar migraciones existentes y sembrar datos iniciales:

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

3. Iniciar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

4. Abrir [http://localhost:3000](http://localhost:3000) e iniciar sesión con `admin` / `1234`.

## Scripts útiles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo Next.js |
| `npm run build` | Compila la aplicación para producción |
| `npm run start` | Inicia la aplicación compilada |
| `npm run lint` | Ejecuta ESLint |
| `npm run db:migrate` | Crea y aplica una nueva migración en desarrollo |
| `npm run db:deploy` | Aplica migraciones pendientes en SQLite |
| `npm run db:seed` | Ejecuta el seed inicial (`admin` / `1234` y parcelas de ejemplo) |
| `npm run db:studio` | Abre Prisma Studio para inspeccionar SQLite |
