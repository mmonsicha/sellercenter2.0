# รับบางส่วน (Partial Receive) — Option B

> ต่อจาก `MULTI-DESTINATION-IA-WIREFRAME.md` (Stage 2)
> ทำบน prototype ที่อนุมัติแล้ว — scenario **"รับบางส่วน"** variant **B · 2 กอง + chevron**
> v1 · 2026-09-22

---

## 1. ฟีเจอร์นี้คืออะไร

ลูกค้าเดินเข้าร้าน ซื้อของ 4 ชิ้น — 2 ชิ้นมีของอยู่หน้าร้าน รับกลับได้เลย อีก 2 ชิ้นต้องส่งตามไปทีหลัง
เดิมทำไม่ได้: `รูปแบบการรับสินค้า` เป็นค่าเดียวของทั้งบิล ถ้าเลือก "จัดส่งให้ลูกค้า" ก็ต้องส่งทุกชิ้น

Option B เปลี่ยนคำถามจาก **"บิลนี้เอายังไง"** เป็น **"ชิ้นนี้เอายังไง"** — และตอบด้วย
**ตำแหน่งในลิสต์** ไม่ใช่ปุ่ม toggle ที่ทุกบรรทัด

```
รายการสินค้า
┌ 🏬 รับทันที ─────────────── 2 รายการ · 3 ชิ้น ┐
│  เสื้อยืดคอกลม              ฿780        [ ⌄ ] │
│  ถุงเท้า 3 คู่               ฿180        [ ⌄ ] │
└────────────────────────────────────────────┘
┌ 🚚 จัดส่ง ───────────────── 2 รายการ · 1 พัสดุ ┐
│  ครีมกันแดด                 ฿320        [ ⌃ ] │
│  E-voucher ฿500  ⚡ดิจิทัล   ฿500        [ ⌃ ]🚫│
│  🔒 สินค้าดิจิทัลส่งทางอีเมลเท่านั้น              │
└────────────────────────────────────────────┘
```

---

## 2. หลักการตัดสินใจ 3 ข้อ

### 2.1 ไม่เพิ่ม `FullfilmentType` ค่าที่ 4

Prototype แสดง `รับบางส่วน แล้วส่งที่เหลือ` เป็น**ตัวเลือกใน dropdown** — เราไม่ทำแบบนั้น

| เหตุผล | อ้างอิง |
|---|---|
| `resolveOrderFlow()` map `ShopDelivery` → `POS_OFFLINE_SUKIPAY_DELIVER_FROM_STORE_V1` ซึ่งเป็น flow **ที่ถูกต้องอยู่แล้ว** สำหรับบิลที่มีของส่ง | `utils/order-flow.ts:17-23` |
| ค่าที่ 4 จะไหลลง `saleChannel.saleOrigin` โดยที่ backend ไม่รู้จัก | `Cart.svelte:handleSelectOption` |
| ต้องเพิ่ม i18n key + `fullfilmentMeta` + `orderDeliveryI18nKey` ให้ค่าที่ payload ไม่ควรมี | `utils/i18n-keys.ts:193-195` |
| แคชเชียร์ต้องเลือกโหมด **ก่อน**หยิบของ ทั้งที่ยังไม่รู้ว่าชิ้นไหนมีสต๊อก | §1 C4 |

**แทนที่ด้วย:** กอง 2 กองโผล่เมื่อ `isPos && fullfilmentType === ShopDelivery`
ทุกบรรทัดตั้งต้นที่กอง `จัดส่ง` แคชเชียร์กด ⌃ ดึงขึ้นมาเอง
คำว่า `· รับบางส่วน` ยังโผล่ที่แถว `รูปแบบการรับสินค้า` — แต่เป็น **state ที่ derive ได้** ไม่ใช่ตัวเลือกที่ต้องกด

> **C4 ยังอยู่ครบ** — บิล `รับสินค้าไปเลย` / `รับภายหลัง` / ONLINE / LINK_BILL render เหมือนเดิมทุก pixel

### 2.2 กองรับทันที = `DeliveryGroupKind.PickupInStore` ของเดิม

ไม่สร้าง kind ใหม่ ของเดิมตรงอยู่แล้วทุกข้อ:

| ต้องการ | `PickupInStore` ให้แล้ว |
|---|---|
| ไม่มีที่อยู่ | `isPickupKind()` → `isDestinationReady()` = true เสมอ |
| ไม่มีค่าส่ง | `kindNeedsShippingMethod()` = false → แถววิธีส่งไม่ render |
| ไม่บล็อกปุ่มจ่ายเงิน | ไม่เข้า `deliverySummary.missing` |
| icon + label | `groupKindIcon()` / `groupKindLabel()` |

ของใหม่มีแค่ `SplitReason.Receive` — ตัวเดียวที่แยก "กองที่แคชเชียร์ยื่นข้ามเคาน์เตอร์"
ออกจาก "พัสดุ pickup ของบิล walk-in ที่มีดิจิทัลบังคับให้แตกกลุ่ม"

### 2.3 กองรับทันที `locked: true`

ไม่ใช่เพราะห้ามแก้ — แต่เพราะ **แก้ได้ที่เดียว** คือบรรทัดสินค้าในตะกร้า
ถ้าปล่อยให้ drawer ย้ายเข้า/ออกได้ด้วย จะมี 2 ปุ่มคุมข้อเท็จจริงเดียวกัน

`locked` ที่มีอยู่แล้วให้ guard ครบชุดฟรี: `moveItemToGroup` ปฏิเสธ · `canRemoveDeliveryGroup` = false · dropdown `ย้าย` เทา

แต่ copy ต้องเปลี่ยน — `แยกอัตโนมัติ` และ `ย้ายออกจากพัสดุนี้ไม่ได้` **เป็นคำโกหก**สำหรับกองนี้
ในการ์ด handover จึงเขียนว่า `สลับรับ/ส่งได้ที่รายการสินค้าในตะกร้า` แทน

---

## 3. สิ่งที่ prototype มี แต่ repo ยังทำไม่ได้

### 🔴 `canNow: false` เหลือเหตุผลเดียว

Prototype ล็อก 2 กรณี — **สาขานี้ของหมด** และ **Pre-order** — ทั้งคู่ต้องใช้ข้อมูลสต๊อกที่ repo นี้ไม่มี:

| สิ่งที่ต้องใช้ | สถานะจริง |
|---|---|
| ระดับสต๊อกรายสาขา | `SaleProduct` มีแค่ `type` — `sale.ts:1-10` ไม่มี field สต๊อกเลย |
| flag pre-order / วันพร้อมส่ง | ไม่มีทั้งใน `SaleProduct` และ `pis-gen.ts` |
| ต้นทางของสินค้า | `TCartItem.originId` / `originName` มี field แต่ **ไม่มีใครเขียนค่าลงไป** (`grep` ทั้ง repo เจอแค่ declaration + consumer) |

**สิ่งที่ทำจริง:** `receiveNowBlockReason()` เป็น predicate เดียวที่ทุก caller ถาม
วันนี้ตอบ block ได้ 1 กรณี — สินค้าดิจิทัล (`สินค้าดิจิทัลส่งทางอีเมลเท่านั้น`)
กรณี foreign origin เขียนไว้แล้วแต่ **หลับอยู่** เพราะไม่ส่ง `sellingOriginId` เข้าไป

> ไม่ส่ง `$currentStore.id` เป็น `sellingOriginId` โดยตั้งใจ — `originId` เป็น id ของคลัง
> ส่วน `currentStore.id` เป็น id ของร้าน คนละ id space กัน ถ้าจับมาเทียบกันตอนนี้
> วันที่ origin เริ่มมีค่าจริงจะได้ `รับที่สาขานี้ไม่ได้` ที่ผิดทุกบรรทัด

UI ของการล็อก (ปุ่ม disabled + 🔒 + เหตุผล) **ต่อสายครบแล้ว** รอแค่ข้อมูล
เติมเหตุผลใหม่ที่ `receiveNowBlockReason()` ที่เดียว ไม่ต้องแก้ component

### 🟡 ใบเสร็จยังไม่แยก "รับแล้ว / รอจัดส่ง"

Prototype เขียนใน hint ใต้ปุ่มเก็บเงินว่า *"ใบเสร็จจะแยก 'รับแล้ว' กับ 'รอจัดส่ง'"*

ใบเสร็จคือ `lib/paper-template/order-receipt.json` render ด้วย package ภายนอก
`sellsuki-paper-template-renderer` — ไม่มี section แบบนั้นและ `makeOrderReceiptData()`
ก็แค่บวกค่าส่งกับนับ qty (`template-handler.ts:12-33`)

**เราจึงตัดประโยคนั้นออกจาก copy** เหลือเฉพาะสิ่งที่จริง:
`หลังเก็บเงิน ส่งมอบ N ชิ้นให้ลูกค้าที่เคาน์เตอร์`

> ห้ามเขียน UI สัญญาสิ่งที่ระบบไม่ทำ — หลักเดียวกับที่ `feature-flags.ts` ปิด discount code
> ไว้เพราะยังไม่มี endpoint ตรวจโค้ด

### 🟡 หลังปิดบิลแล้วไม่มีสถานะแยกกอง

OQ 4 ยังบล็อกอยู่ (`MULTI-DESTINATION-REWORK.md §2`) — order มี `state` เดียวทั้งบิล
ดังนั้น "รับแล้ว 3 ชิ้น / รอจัดส่ง 2 ชิ้น" แสดงใน order detail ไม่ได้ ยังอยู่นอก scope

---

## 4. แผนพัฒนา component

### 4.1 Data layer — `src/lib/entities/order/delivery-group.ts`

| เพิ่ม | ทำอะไร |
|---|---|
| `ReceiveMode` (`Now` / `Ship`) | โหมดของ **บรรทัด** ไม่ใช่ของบิล |
| `receiveModeOf(raw?)` | default = `Ship` (ฝั่งปลอดภัย — ship บังคับให้ต้องมีปลายทาง ซึ่ง pay gate ตรวจได้) |
| `SplitReason.Receive` | + `splitReasonText` case |
| `isHandoverGroup(g)` | predicate เดียวที่ทุกที่เรียก |
| `receiveNowBlockReason(item, ctx)` | **จุดเดียว**ที่ตัดสินว่ารับเลยได้ไหม (§3) |
| `canReceiveNow(item, ctx)` | negation ของข้างบน |
| `handoverItemQty(group, items)` | qty อยู่ที่ cart line ไม่ใช่ที่ group — `deliverySummary` จึงยังเป็น pure function ของ `deliveryGroups` ไม่ผูก cart store |

`TCartItem.receiveMode?: string` (`stores/cart/index.ts`) — optional เพราะ cart ที่ค้างใน localStorage ต้อง parse ได้
`SetCartItemReceiveMode(id, mode)` (`stores/cart/cart.ts`) — รูปเดียวกับ `UpdateCartItemQty`

### 4.2 Sync engine — `src/stores/order/delivery-group.ts`

เพิ่ม **step 1.5** คั่นระหว่างขั้นดิจิทัล (1) กับขั้นต้นทาง (2):

```
1)   ดิจิทัล            → locked group (เดิม)
1.5) รับทันที           → locked PickupInStore / SplitReason.Receive / fee 0   ← ใหม่
2)   ต้นทางส่วนน้อย      → locked group (เดิม)
3)   soft split ของผู้ใช้ → (เดิม)
4)   ที่เหลือ            → default group (เดิม)
```

**ทำไมต้องก่อนขั้นต้นทาง:** ของที่กำลังยื่นข้ามเคาน์เตอร์ไม่ต้องการพัสดุแยกตามคลัง
ไม่ว่ามันจะมาจากคลังไหนก็ตาม

Gate ด้วย `ctx.allowPartialReceive && ctx.isDelivery` — บิล pickup ไม่มี "ฝั่งที่ส่ง" ให้ opt out ตั้งแต่แรก

`deliverySummary` เพิ่ม 2 field โดย **ไม่แตะของเดิม**:
- `handoverGroup`
- `parcelCount` — group ที่เดินทางจริง (ไม่นับ handover)

> `count` ยังหมายถึงจำนวน group ทั้งหมดเหมือนเดิม เพราะ `พัสดุ N/M` ในการ์ด,
> `firstMissingSeq` และ mini-nav chip นับจาก**ตำแหน่งดิบ**ทั้งหมด — แยก count ตรงนี้
> จะทำให้ทั้งสามตัวชี้คนละใบกับที่ drawer วาด

### 4.3 UI

| ไฟล์ | สถานะ | ทำอะไร |
|---|---|---|
| `cart/CartReceivePiles.svelte` | **ใหม่** | หัวกอง 2 กอง (+ กองบริการถ้ามี) · นับจำนวน · empty state · toast + เลิกทำ |
| `cart/CartItem.svelte` | แก้ | props `pile` / `onMovePile` / `sellingOriginId` · ปุ่ม ⌃⌄ · บรรทัดเหตุผลล็อก · ซ่อน badge ที่ซ้ำกับหัวกอง |
| `cart/Cart.svelte` | แก้ | `allowPartialReceive` · ส่งเข้า sync ctx · สลับ list · summary `รับเลย N ชิ้น · M พัสดุ` · suffix `· รับบางส่วน` |
| `cart/section/DrawerDelivery.svelte` | แก้ | การ์ด handover (สีเขียว, copy 4 จุด) · banner `รับที่เคาน์เตอร์ 1 · จัดส่ง N` · กัน `฿0` หลุดเข้า fee breakdown |
| `cart/CartFooter.svelte` | แก้ | fee row ใช้ `parcelCount` · hint ส่งมอบใต้ปุ่มเก็บเงิน |

**หลักที่ใช้ใน `CartItem`:** ในโหมดกอง ให้ **ซ่อน badge ที่พูดซ้ำกับหัวกอง** (Shipping ในกองจัดส่ง,
PickupInStore ในกองรับทันที) แต่ **เก็บ** badge ดิจิทัล / บริการ / ต้นทางไว้ — พวกนี้บอกสิ่งที่หัวกองไม่ได้บอก
ที่ว่างที่ได้คืนมาคือที่ของปุ่ม ⌃⌄ พอดี ไม่ต้องเพิ่ม column ที่ 4 ในกริด 340px

**bug ที่ต้องแก้ก่อนแยกลิสต์:** `_onClickCart(item, idx)` ใช้ `GetExistingCart()[idx]`
พอลิสต์ถูกแยกเป็น 2 slice, `idx` กลายเป็น index ของกอง ไม่ใช่ของตะกร้า → ชี้ผิดชิ้น
เปลี่ยนเป็นหาด้วย `product_id`

---

## 5. ทำไมถึงเลือก B ไม่ใช่ A

| | A · ปุ่มที่บรรทัด | B · 2 กอง + chevron |
|---|---|---|
| ตอบคำถาม | "ชิ้นนี้เอายังไง" ทีละชิ้น | "กองไหนมีอะไรบ้าง" มองปราดเดียว |
| ของน้อย (2-3 ชิ้น) | อ่านง่ายกว่า | พอ ๆ กัน |
| ของเยอะ (8+ ชิ้น) | ต้องไล่อ่านทุกบรรทัด | **ตำแหน่ง = คำตอบ** |
| พื้นที่ต่อบรรทัด | ปุ่ม 2 ปุ่ม + badge | ปุ่มเดียว + ไม่มี badge ซ้ำ |
| ต้นทุน | บรรทัดสูงขึ้นทุกบรรทัด | 2 หัวกอง (คงที่) |
| ข้อเสีย | ที่แคบ ปุ่มเล็ก | รายการ**ขยับตำแหน่ง**ทุกครั้งที่กด |

POS panel กว้าง ~340px ที่ 1024 (§1 C1) — ปุ่ม 2 ปุ่มต่อบรรทัดของ A แย่งที่กับชื่อสินค้าและ stepper
B จ่ายค่าคงที่ 2 หัวกอง แล้วได้ที่คืนจาก badge ที่ไม่ต้องมี

**ยังไม่ใส่ drag** — จอ POS เป็นทัชสกรีนและลิสต์ scroll แนวตั้ง drag จะชนกับการเลื่อนหน้าจอ
และ screen reader ใช้ไม่ได้ ถ้าจะเพิ่ม drag ให้เพิ่ม**ทับ** chevron ไม่ใช่แทน

---

## 6. Edge case

| เคส | พฤติกรรม |
|---|---|
| ย้ายทุกชิ้นขึ้นกองรับทันที | เหลือ 1 group → `showDeliveryDetail` = false → ไม่มีแถวการจัดส่ง ไม่มีค่าส่ง · กองจัดส่งขึ้น empty state แนะนำให้เปลี่ยนเป็น "รับสินค้าไปเลย" · **บิลยังเป็น `ShopDelivery` อยู่ จึงยังบังคับที่อยู่** (`isBuyerValid` ใน `Cart.svelte:862`) — ทางออกคือเปลี่ยน fulfilment ซึ่งถูกต้องตาม semantic อยู่แล้ว เพราะบิลไม่มีของส่งอีกต่อไป |
| สินค้าดิจิทัลในบิล | ล็อกอยู่กองจัดส่ง ปุ่ม ⌃ เทา + เหตุผล · ยังต้องมีอีเมลเหมือนเดิม |
| สินค้าบริการ (gift wrap) | ไม่เข้ากองไหนเลย — section `✨ บริการ` แยกต่างหาก ไม่มีปุ่มย้าย |
| สลับ fulfilment ไป-กลับ | `receiveMode` ค้างอยู่ที่ item (persist ใน localStorage) — กลับมาที่ ShopDelivery แล้วได้ของเดิม |
| สลับไป ONLINE | `allowPartialReceive` = false → sync มองข้าม `receiveMode` ทั้งหมด ไม่มีกอง handover หลุดไปบิล online |
| กด ⌃⌄ | มี toast + **เลิกทำ** (รูปเดียวกับ `showMoveUndo` ใน drawer) |
| เพิ่มสินค้าใหม่กลางบิล | ไม่มี `receiveMode` → default `Ship` (ฝั่งปลอดภัย) |

---

## 7. ยังไม่ได้ทำ — รอ gate

| ส่วน | รอ | ที่เติม |
|---|---|---|
| ล็อก "สาขานี้ของหมด" / "Pre-order" | สัญญาณสต๊อกจาก PIS | `receiveNowBlockReason()` จุดเดียว |
| ล็อก "มาจากคนละคลัง" | `originId` ถูกเขียนค่าจริง + origin ของร้านอยู่ id space เดียวกัน | ส่ง `sellingOriginId` เข้า ctx |
| ใบเสร็จแยก รับแล้ว/รอจัดส่ง | layout ใน `order-receipt.json` | `makeOrderReceiptData()` + template |
| สถานะแยกกองหลังปิดบิล | **OQ 4** (per-group status จาก backend) | order detail |
| ส่ง handover group ไป backend จริง | **OQ 9** (`Delivery.id` / `items[]`) | `commitDeliveryGroupsToOrder()` — วันนี้ยังพับค่าส่งรวมกลับเข้า `deliveries[0]` ตัวเดียว |
