# Registro de Ventas en Solana con PDAs

![banner](./images/banner.jpg)

**Ruta elegida:** Proyecto guiado con una mejora funcional (WayLearn · Solana Engineering Track: Advanced).
**Versión de partida:** [WayLearnLatam/Registro-Ventas-Solana-PDA](https://github.com/WayLearnLatam/Registro-Ventas-Solana-PDA) (cierre de las sesiones 1–5).

- **Nombre (para el certificado):** `[COMPLETAR]`
- **Correo de registro:** `[COMPLETAR]`
- **Program ID (Devnet):** `[COMPLETAR]` · [Ver en Solana Explorer](https://explorer.solana.com/address/PROGRAM_ID?cluster=devnet)
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

Datos de la práctica: negocio `[COMPLETAR]`, clientes Ana (id 1), Luis (id 2), Marta (id 3).

| Caso | Resultado esperado | Resultado observado | Transacción / error |
| --- | --- | --- | --- |
| Crear Registro y Clientes | Cuentas creadas y legibles | `[COMPLETAR]` | `[Explorer]` |
| Registrar venta válida | Se crea Venta; `compras` = 1; referencia en `historial` | `[COMPLETAR]` | `[Explorer]` |
| Corregir el importe | Cambia el monto de la misma Venta | `[COMPLETAR]` | `[Explorer]` |
| Devolución válida | Se cierra Venta; Cliente actualizado | `[COMPLETAR]` | `[Explorer]` |
| Baja de cliente vacío | Se cierra Cliente; referencia retirada; `id_counter` sin cambio | `[COMPLETAR]` | `[Explorer]` |
| Siguiente alta tras la baja | Marta recibe id 3 (no reutiliza el 1) | `[COMPLETAR]` | `[Explorer]` |
| Wallet no autorizada | Rechazo `NoOwner`; datos intactos | `[COMPLETAR]` | `[error]` |
| Venta ajena al cliente | Rechazo `ConstraintSeeds` | `[COMPLETAR]` | `[error]` |
| Baja con ventas activas | Rechazo `ClienteConVentas`; cuentas y referencias intactas | `[COMPLETAR]` | `[error]` |
| **[Aporte]** Monto = 0 | Rechazo `MontoInvalido`; no se crea la cuenta | `[COMPLETAR]` | `[error]` |
| **[Aporte]** SKU de 6 caracteres | Rechazo `SkuInvalido` | `[COMPLETAR]` | `[error]` |

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
