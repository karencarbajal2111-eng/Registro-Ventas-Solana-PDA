# Registro de Ventas en Solana con PDAs

![banner](./images/banner.jpg)

**Ruta elegida:** Proyecto guiado con una mejora funcional (WayLearn · Solana Engineering Track: Advanced).
**Versión de partida:** [WayLearnLatam/Registro-Ventas-Solana-PDA](https://github.com/WayLearnLatam/Registro-Ventas-Solana-PDA) (cierre de las sesiones 1–5).

- **Nombre (para el certificado):** Karen López Carbajal
- **Correo de registro:** kaarl7476@gmail.com
- **Program ID (Devnet):** `6oWpDCks3gXPfDiGhzPS2ypQUv2SQ36YZt9QVY9yLAbX` · [Ver en Solana Explorer](https://explorer.solana.com/address/6oWpDCks3gXPfDiGhzPS2ypQUv2SQ36YZt9QVY9yLAbX?cluster=devnet)
- **Frontend:** `[COMPLETAR: enlace al repo/carpeta del frontend]`

## Propósito

Programa de Solana (Rust + Anchor) para un negocio pequeño: un **Registro** del negocio, sus **Clientes** y las **Ventas** de cada cliente. Cada cuenta es una PDA derivada de su padre:

```
registro <- ["registro", nombre_negocio, owner]
cliente  <- ["cliente",  registro, id_cliente (u16 LE)]
venta    <- ["venta",    cliente,  sku]
```

La pertenencia queda garantizada por las seeds y la autoridad por `has_one = owner`.

## Instrucciones del programa

| Instrucción | Qué hace |
| --- | --- |
| `crear_registro` | Crea el Registro del negocio. |
| `crear_cliente` | Alta de cliente; el programa asigna el id con `id_counter`. |
| `registrar_venta` | Crea la Venta y actualiza `historial` y `compras` del Cliente. |
| `cambiar_monto` | Corrige el monto de una Venta existente. |
| `hacer_devolucion` | Cierra la cuenta de la Venta (`close = owner`) y actualiza el Cliente. |
| `eliminar_cliente` | **Baja de cliente (sesión 5).** Solo si `historial` está vacío y `compras == 0`; cierra la cuenta, retira su referencia del Registro y **no** modifica `id_counter`. |

## Aporte propio

Sobre la base guiada (que ya incluye la baja de cliente) añadí **validaciones de negocio en Rust**, cada una con su caso de rechazo probado:

| Regla nueva | Error | Dónde |
| --- | --- | --- |
| El monto debe ser mayor a 0 | `MontoInvalido` | `registrar_venta`, `cambiar_monto` |
| El SKU no puede estar vacío ni exceder 5 caracteres | `SkuInvalido` | `registrar_venta` |
| La descripción no puede exceder 50 caracteres | `DescripcionInvalida` | `registrar_venta` |
| Máximo 10 clientes por Registro | `RegistroLleno` | `crear_cliente` |
| Máximo 10 ventas por Cliente | `HistorialLleno` | `registrar_venta` |
| El cliente debe estar referenciado en el Registro | `ClienteNoRegistrado` | `eliminar_cliente` |

**Qué mejora:** antes, una venta de monto 0 se aceptaba, y un SKU largo o el cliente número 11 fallaban con un error de serialización poco claro. Ahora el programa rechaza esos casos con un error específico y sin modificar ningún estado.
**Cómo se comprueba:** pruebas `[APORTE]` de `tests/anchor.test.ts` (ver tabla de evidencias).

Además corregí los ejemplos de `client/client.ts`: el SKU `"Sabritas"` (8 caracteres) excedía `max_len(5)`; ahora es `"SAB01"`.

## Cómo ejecutarlo

1. Abre el proyecto en [Solana Playground](https://beta.solpg.io/https://github.com/karlacateee-blip/Registro-Ventas-Solana-PDA), conéctalo a **Devnet** y pide airdrop.
2. **Build** → **Deploy**. Anota el Program ID.
3. **Test** (`tests/anchor.test.ts`) para correr las pruebas automáticas.
4. `client/client.ts`: descomenta la operación que quieras probar y pulsa **Run**.
5. Frontend: `[COMPLETAR: pasos — instalar, importar IDL (npm run configurar:idl -- ./idl.json), npm run dev, conectar Solflare en Devnet]`.

## Pruebas y evidencias (Devnet)

Negocio de la práctica: **Tiendas 3B**. Cliente: Isaac K (id 1).
Wallet de la práctica: `4nDoX1ZSuzZTM4a4Xc6CKyLybK5DiJAW1NZZ7iwe8Gty`.

Además de las operaciones reales de abajo, `tests/anchor.test.ts` ejecuta **11 pruebas automáticas contra Devnet y las 11 pasan** (captura en `evidencias/`).

### Operaciones reales (cliente `client/client.ts`)

| Caso | Resultado esperado | Resultado observado | Transacción |
| --- | --- | --- | --- |
| Crear Registro | Se crea la cuenta Registro | Creado | [Explorer](https://explorer.solana.com/tx/3Thsnj8C9VrV4vBuRg4Lgq1FT6WXvJgrMdmzg3eN39w9kg611wwz6c7K6WctzxnD87pGouxWW8L8oXXN8bsqsRaV?cluster=devnet) |
| Crear Cliente | Cliente id 1 creado y referenciado en el Registro | "Cliente Isaac K creado con id: 1" | [Explorer](https://explorer.solana.com/tx/3TYp9AvRJVKb15YPgkRp7PdtqQ9cE8QPakqynKhDuaE5UdnccMsPGVwMB8UptdgAPnZyPiAnXHP8P7GGT9gPQdjZ?cluster=devnet) |
| Registrar venta válida (SKU `SAB01`) | Se crea Venta; `compras` y `historial` del Cliente se actualizan | Venta creada | [Explorer](https://explorer.solana.com/tx/2WDj87VvaJpNMdgDWiBc4Nuk9bD7S3wCZLCq47eZ4whbZrSu2eoWvAzQqwSPVPpHH4D7XRphZiJmVFKmPcbbjxCV?cluster=devnet) |
| Registrar una segunda venta | Se crea otra Venta del mismo cliente | Venta creada | [Explorer](https://explorer.solana.com/tx/3ipWTvAiwqea5K9rMqtmVidXndvNRDkuiroJDWNLoXcmWXtKST9dE3axpiVvFt5PQftz5n5BnDdvqQ3rjg8r1KZD?cluster=devnet) |
| Corregir el importe | Cambia el monto de la misma Venta | Monto actualizado | [Explorer](https://explorer.solana.com/tx/4LWPj36qyWnDoguBTfdjB8WhcXbQKuW9v5wjLRj6PsyP1KySaHcHdqzGTHiAitvVE5kc7k4XbFJN9f49UvzzGviA?cluster=devnet) |
| Devolución válida (1.ª venta) | Se cierra la Venta; Cliente actualizado | Venta cerrada | [Explorer](https://explorer.solana.com/tx/p5EivMSbdAoyfsVhb5g9c8q5Q7C57DuiwpuJJykt5AUYkuzZm83mKhMoNk7u8gx6Z8WZbnzEmNrfuFSqguvwoob?cluster=devnet) |
| Devolución válida (2.ª venta) | Se cierra la Venta; Cliente sin ventas | Venta cerrada | [Explorer](https://explorer.solana.com/tx/3RVGny3B1WptkYFMEsueLvKJN8nixkej6AHf4kJqrKkxvbJiUzhhDneER148zPvBVA3JZ2qqCmEBBMWvzhWeWkGd?cluster=devnet) |
| **Baja de cliente vacío** | Se cierra Cliente, se retira su referencia, `id_counter` no retrocede | `verClientes` muestra "Ultimo id asignado: 1" y "Registro vacío, aún no hay clientes" | [Explorer](https://explorer.solana.com/tx/hj2C61WX2DHMmAP3pFjY5qzGy3DyTrYLHQjG8ykoA9iLwSPDbbA6hZM5v8YUuhc43uCmYk5NLWjdQoZ8JbZeeTn?cluster=devnet) |
| **Baja con ventas activas** | Rechazo del programa; cuentas y referencias intactas | `AnchorError ... Error Code: ClienteConVentas. Error Number: 6002` en `lib.rs`; el cliente siguió existiendo y pudo devolverse después | Rechazo en simulación (sin transacción); captura en `evidencias/` |

### Rechazos probados con las pruebas automáticas

| Caso | Error esperado | Prueba |
| --- | --- | --- |
| Wallet no autorizada | `NoOwner`; datos intactos | `RECHAZA wallet no autorizada (NoOwner)` ✔ |
| Venta ajena al cliente | `ConstraintSeeds` | `RECHAZA venta ajena al cliente (ConstraintSeeds)` ✔ |
| **[Aporte]** Monto = 0 al registrar y al corregir | `MontoInvalido`; no se crea la cuenta | `[APORTE] RECHAZA monto = 0 ...` ✔ |
| **[Aporte]** SKU de 6 caracteres | `SkuInvalido` | `[APORTE] RECHAZA sku de mas de 5 caracteres` ✔ |
| Baja con ventas activas | `ClienteConVentas`; cuentas intactas | `RECHAZA dar de baja a un cliente con ventas activas` ✔ |
| El siguiente alta no reutiliza ids | Marta recibe id 3 | `El siguiente cliente recibe id 3` ✔ |

Los rechazos fallan en la simulación previa, por eso no tienen firma consultable en el Explorer.

## Estructura del repositorio

```
src/lib.rs            Programa Anchor (Rust)
tests/anchor.test.ts  Pruebas del programa (Playground)
client/client.ts      Cliente de TypeScript
idl/                  IDL exportado de la versión desplegada  [COMPLETAR]
frontend/             Aplicación con wallet                    [COMPLETAR]
```

## Notas de seguridad y alcance

Proyecto educativo en Devnet. No incluye claves ni secretos. Antes de un uso real faltaría revisar límites de almacenamiento, gestión de autoridades del programa y reintentos de transacciones.
