# Multi-destination Order Rework — Code Reality Check

> Stage 1.5 · ต่อจาก `multi-destination-order-rework.md` (Stage 1, v1, 2026-09-14)
> ตรวจ requirement กับโค้ดจริงใน Seller Center Frontend ก่อนเข้า Stage 2
> v1 · 2026-09-14

---

## 0. ทำไมต้องมีเอกสารนี้

เอกสาร Stage 1 เขียนได้ดีมากในเชิง domain reasoning — ข้อสรุป **"Order ≠ Shipment"** ถูกต้อง และการวิเคราะห์ว่าทำไม tab ใช้ไม่ได้ (§4) ก็ตรงประเด็น

แต่ Stage 1 เขียนขึ้น **โดยยังไม่ได้อ่าน flow ปัจจุบัน** — เอกสารระบุข้อจำกัดนี้ไว้เองใน §0 และเขียนว่า *"ถ้า flow เดิมต่างจากที่สมมติ ให้แก้ §6 เป็นอันดับแรก"*

ตรวจโค้ดแล้ว — **flow เดิมต่างจากที่สมมติจริง** เอกสารนี้คือผลการตรวจ

---

## 1. สามเรื่องที่พลิกแผน

### 🔴 1. OQ 2 ตอบได้แล้วจากโค้ด — และคำตอบทำให้ §5, §6, §7 ต้องเขียนใหม่

เอกสาร Stage 1 ถามว่าฟีเจอร์นี้อยู่ฝั่งลูกค้า (checkout) หรือแอดมินร้าน — และจัดเป็น 🔴 บล็อก

**คำตอบ: แอดมินร้าน (POS) เท่านั้น — repo นี้ไม่มีฝั่งลูกค้าเลย**

| หลักฐาน | ที่มา |
|---|---|
| README บรรทัดแรก: *"**Merchant portal** for the Patona/Sellsuki platform"* | `README.md:1-3` |
| ทุก order แนบ **พนักงานที่ล็อกอิน** เป็น cashier — `cashier_info` เป็น required | `stores/order/order.ts:344-356`, `management-gen.ts:461` |
| ผู้ซื้อ default = `'ลูกค้าหน้าร้าน'` (walk-in) | `stores/order/order.ts:312-321` |
| เลือกลูกค้าจาก **สมุดลูกค้าฝั่งพนักงาน** ไม่ใช่ authenticate | `Cart.svelte:284-304` |
| RBAC ของพนักงานคุม UI (`CUSTOMERCREATE`) | `DrawerCustomerAddress.svelte:130-133` |
| ทุก endpoint เป็น `/store/{store_id}/order/...` | `management-gen.ts:115-189` |
| route ทั้งหมดเป็น admin — ไม่มี storefront/checkout route | `App.svelte:167-187` |

**ผลกระทบ:** §5 วาด wireframe เป็น checkout wizard หลาย step และ §6 วาง userflow 7 ขั้น (เลือกสินค้า → ตะกร้า → ที่อยู่ → วิธีส่ง → ตรวจสอบ → ชำระเงิน → order detail)

ของจริงคือ **หน้าจอเดียว** — `/sales` POS cart ที่แคชเชียร์กดขายหน้าร้าน ทุกอย่างเป็น row + drawer ในจอเดียว ไม่มี step, ไม่มีปุ่ม "ถัดไป", ไม่มี progressive checkout

> §5/§6/§7 ต้องวาดใหม่บนกริดของ POS ไม่ใช่ checkout — **นี่คืองานหลักของ Stage 2**

และ persona ก็เปลี่ยน: J1-J4 ใน §7 เขียนเป็น "ลูกค้า" ทั้งหมด ของจริงคือ **แคชเชียร์ที่ทำงานเร็วและทำซ้ำทั้งวัน** — ซึ่งยิ่งทำให้ข้อโต้แย้งเรื่อง J1 (zero-cost path) **สำคัญกว่าเดิมอีก** ไม่ใช่น้อยลง

---

### 🔴 2. Backend บล็อก E1 และ E2 — frontend ทำเองไม่ได้

Stage 1 §11 เสนอว่า **E1 ship ก่อนได้เลย** โดยยังไม่มี UI แยกที่อยู่ ("ข้อเสนอที่สำคัญที่สุดในเอกสารนี้")

ไอเดียถูก แต่ **ทำไม่ได้ตามที่เขียน** เพราะ backend ยังไม่มีที่เก็บข้อมูล

ข่าวดีคือ `orderRequest` **มี array อยู่แล้ว**:

```ts
// management-gen.ts:458-470
orderRequest: {
  buyer, buyer_statement?, cashier_info,
  deliveries?: components["schemas"]["Delivery"][];   // ← array มีอยู่แล้ว
  flow_type, items, provider_code, refs?, sale_channel, seller, seller_statement?
}
```

ข่าวร้ายคือ `Delivery` ข้างในว่างเปล่า:

```ts
// management-gen.ts:218-224 — ทั้งหมดที่มี
Delivery: {
  courier: string; method: string; remark: string;
  shipping_fee: number; type: string;
}
```

**ไม่มี `address` · ไม่มี `id` · ไม่มี `items[]` · ไม่มี `status` · ไม่มี `sender/origin` · ไม่มี timing**

แปลว่ามันเป็น array ที่ **ชี้ปลายทางไม่ได้ ผูกสินค้าไม่ได้ ติดตามแยกกันไม่ได้** — เป็นถุงใส่ค่าขนส่ง 5 ตัวเท่านั้น

ซ้ำร้าย ฝั่ง frontend ก็ hardcode `[0]` ทุกจุด และ `setDelivery()` **ทำลาย array ทิ้ง**:

```ts
// stores/order/order.ts:288-293
setDelivery(delivery) { ... deliveries: [delivery] }   // ← เขียนทับทั้ง array
```

จุดที่ hardcode `[0]`: `stores/order/order.ts:71`, `:461-463` · `DrawerOnline.svelte:178-180` · `DrawerChannel.svelte:48-49` · `OrderTable.svelte:271` · `SaleHistoryTab.svelte:263`
มีที่เดียวในทั้ง repo ที่รู้จักหลาย delivery: `lib/paper-template/template-handler.ts:26` (บวกค่าส่งทุกกลุ่ม)

และ **endpoint แก้ delivery ไม่มีทางระบุว่าจะแก้กลุ่มไหน**:

```
PUT /store/{store_id}/order/{order_id}/delivery-channel
body: { courier_method?, courier_type?, shipping_fee? }     // ไม่มี index/id
```

---

### 🟡 3. DOMS มี model ที่ถูกต้องอยู่แล้ว — แต่ไม่ได้ใช้เลยสักบรรทัด

`src/service/doms-gen.ts` (835 บรรทัด) นิยาม domain ที่ **ตรงกับสิ่งที่เอกสาร Stage 1 ต้องการแทบทั้งหมด**:

| สิ่งที่ Stage 1 ต้องการ (§1) | DOMS มีแล้ว |
|---|---|
| ปลายทางต่อกลุ่ม | `shippingAddress` — `doms-gen.ts:242-247` |
| **ผู้ส่ง/ต้นทางต่อกลุ่ม** | `senderAddress`, `pickupAddress` — `:242-247` |
| วิธีจัดส่ง + ค่าส่งต่อกลุ่ม | `ShippingDto` — `:79-112` (`courierID, method, fee, codFee, totalFee`) |
| สถานะแยกต่อกลุ่ม | `LogisticDeliveryStateDto` — `:201-225` (timeline + tracking) |
| ที่อยู่แบบมีโครงสร้าง | `ShippingAddressDto` — `:37-56` |
| น้ำหนัก/ขนาดพัสดุ | `PackagingDto` / `DimensionDto` — `:57-78` |

endpoint พร้อม: `/doms/delivery-orders`, `/doms/delivery-orders/state`, `/doms/couriers`

**แต่ไม่มี `doms-rest.ts` ไม่มี `doms-adapter.ts` และไม่มีไฟล์ไหนใน `src/` import มันเลย** — `grep -rn "doms" src -l` เจอแค่ตัว `doms-gen.ts` เอง

> **ข้อเสนอสำคัญที่สุดของเอกสารนี้:** ก่อนออกแบบ UI ต้องคุยกับทีม backend ก่อนว่า
> **"multi-destination ควรไปทาง DOMS หรือขยาย `Delivery` ใน management?"**
> ถ้าคำตอบคือ DOMS แผนทั้งหมดเปลี่ยนรูป — จากการขยาย order เป็นการต่อ order → delivery-orders
> และ 60-70% ของ data model ที่ Stage 1 ออกแบบไว้ **มีคนทำไปแล้ว**

---

## 2. สรุปคำตอบ Open Questions

| # | คำถาม | สถานะ | คำตอบ / สิ่งที่พบ |
|---|---|---|---|
| 1 | multi sender หมายถึงอะไร | 🟡 **แคบลงแล้ว** | โค้ดมี hook รออยู่แล้ว — ตอนนี้สาขาที่ลูกค้ามารับ **ฝากไว้ใน `seller` block** พร้อมคอมเมนต์ว่า *"The order API has no pickup-branch field yet"* (`stores/order/order.ts:373-378`) README ชี้ว่า `setSellerInfo` คือ *"the single place to redirect once a real field exists"* → **ผู้ส่ง = สาขา/คลัง ระบบกำหนด ผู้ใช้ไม่เลือก** ยังเหลือให้ PO ยืนยันว่ารวม vendor ภายนอกด้วยไหม |
| 2 | ลูกค้า หรือ แอดมินร้าน | ✅ **ตอบแล้ว** | **แอดมินร้าน (POS)** — repo นี้ไม่มีฝั่งลูกค้า ดู §1.1 |
| 3 | ค่าส่ง/ส่วนลด คิดระดับ order หรือ group | 🔴 **ยังบล็อก** | ตอนนี้เป็น scalar เดียวต่อ order (`deliveries[0].shippingFee`) และ **display-only ไม่เข้ายอดรวมจริง** (`buyerStatement` ไม่รับ) — ต้องให้ PO + Finance ตัดสิน |
| 4 | สถานะ order เมื่อกลุ่มไม่พร้อมกัน | 🔴 **ยังบล็อก** | ไม่มี partial shipping เลย `partial_completed` ที่มีอยู่คือ **จ่ายเงินไม่ครบ** ไม่ใช่ส่งไม่ครบ (`payment-transaction.test.ts:52` — *"COMPLETED + underpaid → Partial"*) `state` เป็น string เดียวทั้ง order (`utils-order.ts:291-327`) |
| 5 | "รับทีหลัง" คืออะไร | 🟡 **แคบลงแล้ว** | มี 3 อย่างแยกกันอยู่แล้ว — `FullfilmentType` มี `pickupImmediate / pickupLater / shopDelivery` (`order.ts:40-44`) ส่วน *"ส่งลิงก์ให้ผู้รับกรอกที่อยู่เอง"* ใน §5 = **LINK_BILL channel** ที่มีอยู่แล้วแต่ปิดไว้ (`CartFooter.svelte:833`) |
| 6 | v1 ต้องแยก **จำนวน** ไหม | ✅ **ตอบได้** | **v1 ทำไม่ได้แน่นอน** — cart dedupe ด้วย `product_id` (`stores/cart/cart.ts:20-23`) สินค้าเดียวกันเป็นคนละบรรทัดไม่ได้ ตรงกับที่ §9 เคส 1 เสนอให้เลื่อนไป v2 — **ยืนยันว่าถูกต้อง** |
| 7 | จำนวนกลุ่มสูงสุด | 🟢 | ยังไม่มีข้อจำกัดในโค้ด |
| 8 | DS 1.0 มี pattern card ซ้อน line item ไหม | 🟡 | ยังต้องเช็คกับ `suki-designer` |

**เพิ่มใหม่จากการอ่านโค้ด:**

| # | คำถาม | ถามใคร | ระดับ |
|---|---|---|---|
| **9** | **multi-destination ไปทาง DOMS หรือขยาย `Delivery` ใน management?** | Backend | 🔴 **บล็อกหนักสุด** |
| **10** | **OMS 2.0 spec ว่าไว้ยังไง?** README อ้างถึง spec ที่มี fulfilment **7 ค่า** (ตอนนี้มี 3) และระบุว่ายังขาด *"digital-delivery email"* + *"separate delivery-method block"* — ซึ่งคือ requirement เดียวกับเอกสารนี้ | PO | 🔴 **บล็อก** |
| 11 | `saleChannel.saleOrigin` ถูกใช้ 2 ความหมายทับกัน (fulfilment ตอน POS / sub-channel ตอน ONLINE — `Cart.svelte:182-192` vs `:214-221`) จะแยกตอน rework นี้เลยไหม | Backend + PO | 🟡 |

> ⚠️ **OQ 10 สำคัญมาก** — ถ้า OMS 2.0 spec ตอบ OQ 1/3/4/5 ไว้แล้ว เอกสาร Stage 1 กำลัง re-derive สิ่งที่ทีมตัดสินใจไปแล้ว **ต้องเอา spec มาอ่านก่อนเข้า Stage 2**

---

## 3. Epic split ฉบับแก้

Stage 1 §11 แบ่ง E1-E4 ได้ดี แต่ยังไม่รู้ว่า backend บล็อก จึงเติม **E0** และติดป้าย dependency

| Phase | ขอบเขต | Backend? | สถานะ |
|---|---|---|---|
| **E0 · Signal** *(ใหม่)* | ส่ง `product.type` (physical/digital/service) จาก PIS → cart → order item + badge บนบรรทัดสินค้า + เลิก hardcode `deliveries[0]` ให้ frontend ทน array ยาว >1 | ❌ **ไม่ต้อง** | ✅ **ทำได้เลยวันนี้** |
| **E1 · Foundation** | fulfillment profile ต่อสินค้า + auto hard-split + ที่อยู่เดียวเหมือนเดิม | ✅ ต้องมี `Delivery.id/items[]` | 🔴 รอ OQ 9 |
| **E2 · Multi-destination** | opt-in แยกที่อยู่ + Group Cards + ค่าส่งต่อกลุ่ม | ✅ ต้องมี `Delivery.address` + endpoint ระบุกลุ่ม | 🔴 รอ OQ 9 + OQ 3 |
| **E3 · Deferred & partial** | รับทีหลัง + ลิงก์ให้ผู้รับกรอก + partially shipped + คืนเงินบางส่วน | ✅ ต้องมี per-group status | 🔴 รอ OQ 4 · ทับกับ LINK_BILL ที่ค้างอยู่ |
| **E4 · Scale** | แยก qty, bulk recipient | ✅ + ต้องรื้อ cart dedupe | 🟢 ยังไม่ต้องคิด |

### E0 คืออะไร และทำไมถึงคุ้ม

E0 คือส่วนของ E1 ที่ **ไม่แตะ backend เลย** — แกะออกมาให้ ship ได้ทันที

1. **`type` มีอยู่แล้วใน PIS** — `pis-gen.ts:302-303` ประกาศ `type: "physical" | "digital" | "service"` ชัดเจน
2. **แต่มันหล่นหายระหว่างทาง** — `pis-adapter.ts:13` แปลงเป็น string เปล่า → `TCartItem` (`stores/cart/index.ts:17-26`) ไม่มีช่องเก็บ → `setItem()` (`stores/order/order.ts:394-413`) ทิ้งทั้ง field
3. แค่ต่อท่อให้ครบ ก็ได้ **สาเหตุแตกกลุ่มแบบที่ 1 (§3 — ข้อจำกัดของสินค้า)** ทันที โดยไม่ต้องรอใคร

ได้ผลลัพธ์จริง 3 อย่าง:
- แคชเชียร์เห็นตั้งแต่หยิบของว่าชิ้นไหนเป็นดิจิทัล → ตรงกับหลักการข้อ 3 ของ §5 (*"ประกาศตั้งแต่ตอนหยิบของ ไม่ใช่ตอนจ่ายเงิน"*)
- **พิสูจน์ data model จริงก่อนลงทุน UI ที่แพงที่สุด** — เจตนาเดิมของ E1 ใน §11
- frontend ทน array ยาว >1 ไว้ก่อน พอ backend พร้อมก็ไม่ต้องไล่แก้ 6 จุดที่ hardcode `[0]`

---

## 4. สิ่งที่ต้องขอจาก Backend

ถ้าคำตอบ OQ 9 คือ *"ขยาย management"* นี่คือ schema ที่ต้องเพิ่ม — ระบุให้ชัดเพื่อให้ทีม backend ประเมินได้เลย

```ts
Delivery: {
  // มีอยู่แล้ว
  courier: string; method: string; remark: string;
  shipping_fee: number; type: string;

  // ต้องเพิ่ม
  id: string;                    // ชี้กลุ่มได้ — ขาดตัวนี้ตัวเดียว update ทีละกลุ่มไม่ได้
  recipient: PartyInfo;          // ปลายทาง (ใช้ซ้ำ schema เดิมได้)
  item_refs: string[];           // สินค้าชิ้นไหนอยู่กลุ่มนี้
  origin_id?: string;            // ผู้ส่ง — คลัง/สาขา/vendor  ← multi-sender
  status?: string;               // สถานะแยกต่อกลุ่ม
  scheduled_at?: string;         // timing
  split_reason?: 'product' | 'origin' | 'stock' | 'user';   // §3 hard vs soft split
}
```

`split_reason` มาจาก §3 โดยตรง — เป็นตัวที่ทำให้ UI แยก **hard split (🔒 ล็อก)** ออกจาก **soft split (ยุบได้)** ซึ่ง §5 บอกว่าเป็นกลไกที่ทำให้ pattern นี้รอด ถ้า backend ไม่ส่งมา frontend ต้องเดาเอง และจะเดาผิด

**endpoint ที่ต้องแก้:**
```
PUT /store/{id}/order/{order_id}/delivery-channel
  → ต้องรับ delivery_id ระบุว่าแก้กลุ่มไหน (ตอนนี้ไม่มี)
```

---

## 5. Next step

```
Stage 1     ✓ (multi-destination-order-rework.md)
Stage 1.5   ✓ (เอกสารนี้ — code reality check)
   ↓
🛑 GATE A — Backend: OQ 9 (DOMS หรือ management?)      ← บล็อกหนักสุด
🛑 GATE B — PO: OQ 10 (OMS 2.0 spec ว่าไง?), OQ 3, OQ 4
   ↓
Stage 2   IA + wireframe — วาดใหม่บนกริด POS ไม่ใช่ checkout
          ครบ 6 states + DS 1.0 reality check
   ↓
Stage 3   AI usability 3 persona — เปลี่ยนเป็น **แคชเชียร์** ไม่ใช่ลูกค้า
   ↓
Stage 4-5 refine → vibe code
```

**ทำคู่ขนานได้เลยโดยไม่ต้องรอ gate:** E0 (§3)

### Success metric — ปรับจาก §13

Stage 1 เสนอ 3 ตัว ปรับให้เข้ากับ POS:

- ~~J1 ลูกค้าที่อยู่เดียว~~ → **ขายหน้าร้านปกติ (POS, ไม่ส่ง) จำนวนคลิกต้องไม่เพิ่มขึ้นเลย** — เคสนี้คือ 80-90% ของการใช้งานจริง และแคชเชียร์ทำซ้ำทั้งวัน
- ส่ง 3 ที่อยู่จบได้ในครั้งเดียวโดยไม่ต้องถามใคร
- ~~อัตราละทิ้งตะกร้า~~ → **ไม่มีความหมายบน POS** (แคชเชียร์ไม่ทิ้งตะกร้า ลูกค้ายืนรออยู่ตรงหน้า) → เปลี่ยนเป็น **เวลาต่อบิลเฉลี่ยต้องไม่เพิ่ม** และ **อัตราการยกเลิก/แก้บิลหลังสร้าง**

---

## ภาคผนวก — ตารางเทียบ สมมติฐาน vs โค้ดจริง

| Stage 1 สมมติว่า | โค้ดจริง | อ้างอิง |
|---|---|---|
| ลูกค้า checkout เอง | แคชเชียร์สร้าง order แทน | `README.md:1-3`, `order.ts:344-356` |
| flow มี 7 step | จอเดียว + drawer | `App.svelte:167-187`, `Cart.svelte` |
| ที่อยู่เป็น object ผูกกับ order | **string แบน** ใน `buyer.address` | `order.ts:105`, `customer.ts:39-53` |
| order มี 1 ที่อยู่ | จริง — แต่ customer มี **สมุดที่อยู่** หลายอันอยู่แล้ว | `customer.ts:3-10` |
| ต้องสร้างชั้น delivery group ใหม่ | array มีแล้วแต่ **ว่างเปล่า** | `management-gen.ts:218-224` |
| product ต้องรู้ fulfillment | `type` มีแล้วใน PIS แต่ **หล่นก่อนถึง cart** | `pis-gen.ts:302-303`, `pis-adapter.ts:13` |
| แยก qty เป็นเรื่อง v2 | ถูกต้อง — cart dedupe ด้วย `product_id` บล็อกไว้ | `cart.ts:20-23` |
| ค่าส่งต่อกลุ่มเป็นของใหม่ | ค่าส่งตอนนี้ **ไม่เข้ายอดรวมด้วยซ้ำ** | `README.md:82-84` |
| tab ใช้ได้ที่ order detail | ยังไม่มี order detail แบบหลายพัสดุเลย | — |
